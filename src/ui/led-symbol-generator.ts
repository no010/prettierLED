/**
 * LED Symbol Generator UI Handler
 *
 * Handles message bus communication and symbol creation workflow
 */

import type { CommonTerminalType, LEDChip, LEDSymbolOptions } from '../core/led-symbol-builder';
import {
	calculateLEDGeometry,
	clearSymbolCanvas,
	createLEDChip,
	createLEDPins,
	drawLEDSymbol,
	generateSymbolDescription,
	generateSymbolName,
} from '../core/led-symbol-builder';

const LOG_PREFIX = '[LED]';
const BUILD_STAMP = '2026-03-18T00:00+08:00';
const HANDLER_REVISION = '2026-03-18-led-symbol-v3';
const GLOBAL_RUNTIME_KEY = '__LED_SYMBOL_RUNTIME_STATE__';

const TOPIC_CREATE_SYMBOL = 'LED_CREATE_SYMBOL';
const TOPIC_CLOSE = 'LED_CLOSE';
const GENERATOR_IFRAME_ID = 'led-symbol-iframe';
const LEGACY_IFRAME_IDS = [GENERATOR_IFRAME_ID];

interface RuntimeState {
	isSessionInitialized: boolean;
	handlerRevision: string;
	handlerTasks: any[];
	isHandlingCreate: boolean;
	activeDocumentUuid?: string;
	currentDialogSessionId?: string;
}

function getRuntimeState(): RuntimeState {
	const root = globalThis as any;
	if (!root[GLOBAL_RUNTIME_KEY]) {
		root[GLOBAL_RUNTIME_KEY] = {
			isSessionInitialized: false,
			handlerRevision: '',
			handlerTasks: [],
			isHandlingCreate: false,
			activeDocumentUuid: undefined,
			currentDialogSessionId: undefined,
		} as RuntimeState;
	}
	const state = root[GLOBAL_RUNTIME_KEY] as RuntimeState;
	// Migrate: ensure fields added in newer versions exist on persisted state
	if (state.isHandlingCreate === undefined)
		state.isHandlingCreate = false;
	return state;
}

const runtimeState = getRuntimeState();

function formatError(error: unknown): string {
	if (error instanceof Error)
		return error.stack ? `${error.message} | ${error.stack}` : error.message;
	if (typeof error === 'object' && error !== null) {
		// Handle API error objects
		const errObj = error as any;
		if (errObj.message)
			return String(errObj.message);
		if (errObj.msg)
			return String(errObj.msg);
		if (errObj.error)
			return String(errObj.error);
		try {
			return JSON.stringify(error);
		}
		catch {
			return String(error);
		}
	}
	return String(error);
}

function logInfo(message: string): void {
	eda.sys_Log.add(`${LOG_PREFIX} ${message}`, ESYS_LogType.INFO);
}

function logWarn(message: string): void {
	eda.sys_Log.add(`${LOG_PREFIX} ${message}`, ESYS_LogType.WARNING);
}

function logError(message: string): void {
	eda.sys_Log.add(`${LOG_PREFIX} ${message}`, ESYS_LogType.ERROR);
}

function getMessageBus(): any {
	const bus = eda.sys_MessageBus as any;
	if (!bus || typeof bus.subscribePublic !== 'function' || typeof bus.publishPublic !== 'function')
		throw new TypeError('Host API missing: MessageBus.subscribePublic/publishPublic');
	return bus;
}

function emitPublic(topic: string, payload: any): void {
	const bus = getMessageBus();
	if (typeof bus.publishPublic === 'function') {
		bus.publishPublic(topic, payload);
		return;
	}
	bus.pushPublic(topic, payload);
}

function cleanupHandlerTasks(): void {
	for (const task of runtimeState.handlerTasks) {
		try {
			if (typeof task === 'function')
				task(); // subscribePublic returns an unsubscribe function
			else if (task && typeof task.cancel === 'function')
				task.cancel();
		}
		catch {
			// ignore task cancel errors
		}
	}
	runtimeState.handlerTasks = [];
}

function registerPublicListener(topic: string, callback: (payload: any) => Promise<void> | void): void {
	const bus = getMessageBus();
	const unsub = bus.subscribePublic(topic, callback);
	if (unsub)
		runtimeState.handlerTasks.push(unsub);
}

async function closeGeneratorIFrames(): Promise<void> {
	for (const iframeId of LEGACY_IFRAME_IDS) {
		try {
			await eda.sys_IFrame.closeIFrame(iframeId);
			logInfo(`closeGeneratorIFrames | closed iframe=${iframeId}`);
		}
		catch {
			// ignore missing iframe
		}
	}
}

interface CreateSymbolPayload {
	symbolName: string;
	ledChips: Array<{
		wavelength: number;
		anodePinNumber: string;
		cathodePinNumber: string;
		color: { hex: string };
	}>;
	commonTerminalType: CommonTerminalType;
	commonTerminalPin?: string;
}

const SYMBOL_DOCUMENT_TYPES = new Set<EDMT_EditorDocumentType>([
	EDMT_EditorDocumentType.SYMBOL_COMPONENT,
	EDMT_EditorDocumentType.SYMBOL_NET_FLAG,
	EDMT_EditorDocumentType.SYMBOL_NET_PORT,
	EDMT_EditorDocumentType.SYMBOL_DRAWING,
	EDMT_EditorDocumentType.SYMBOL_NON_ELECTRICAL,
	EDMT_EditorDocumentType.SYMBOL_SHORT_CIRCUIT_FLAG,
	EDMT_EditorDocumentType.SYMBOL_CBB,
]);

async function getActiveSymbolDocumentContext(): Promise<{ documentUuid: string }> {
	const currentDocument = await eda.dmt_SelectControl.getCurrentDocumentInfo();
	if (!currentDocument) {
		throw new Error('未检测到当前编辑文档，请先打开一个符号库文档');
	}

	if (!SYMBOL_DOCUMENT_TYPES.has(currentDocument.documentType)) {
		throw new Error('请在符号库编辑环境中使用此插件');
	}

	return {
		documentUuid: currentDocument.uuid,
	};
}

async function handleCreateSymbol(payload: CreateSymbolPayload): Promise<void> {
	if (runtimeState.isHandlingCreate) {
		logWarn('handleCreateSymbol already in progress, ignoring duplicate invocation');
		return;
	}
	runtimeState.isHandlingCreate = true;
	logInfo(`handleCreateSymbol start | name=${payload.symbolName} | chips=${payload.ledChips?.length || 0}`);
	try {
		if (!payload.ledChips || payload.ledChips.length === 0) {
			throw new Error('未指定LED芯片');
		}

		const activeContext = await getActiveSymbolDocumentContext();
		runtimeState.activeDocumentUuid = activeContext.documentUuid;

		// Create LED chips with color data
		const ledChips: LEDChip[] = payload.ledChips.map(chip =>
			createLEDChip(chip.wavelength, chip.anodePinNumber, chip.cathodePinNumber),
		);

		// Generate symbol name if not provided
		const symbolName = payload.symbolName || generateSymbolName(ledChips, payload.commonTerminalType);

		// Generate description
		const description = generateSymbolDescription(ledChips, payload.commonTerminalType);

		logInfo(`drawing symbol into current document | documentUuid=${activeContext.documentUuid} | name=${symbolName} | description=${description}`);

		// Clear existing primitives before redrawing
		await clearSymbolCanvas();

		// Calculate geometry
		const geometry = calculateLEDGeometry(ledChips, payload.commonTerminalType, payload.commonTerminalPin);

		// Draw LED symbol primitives
		await drawLEDSymbol(geometry);

		// Create pins
		await createLEDPins(geometry, ledChips, payload.commonTerminalType);

		// Save the symbol
		const saved = await eda.sch_Document.save();

		if (!saved) {
			logWarn('symbol save returned false');
		}

		logInfo(`symbol saved | success=${saved}`);

		// Show success message
		eda.sys_Dialog.showInformationMessage(
			`LED符号图元已绘制到当前文档\n\n名称: ${symbolName}\n描述: ${description}`,
			'LED符号生成器',
		);

		// Close iframe
		await closeGeneratorIFrames();
	}
	catch (error) {
		logError(`handleCreateSymbol failed: ${formatError(error)}`);
		eda.sys_Dialog.showInformationMessage(
			`创建LED符号失败：${String(error)}`,
			'LED符号生成器 错误',
		);
	}
	finally {
		runtimeState.isHandlingCreate = false;
	}
}

async function initializeMessageBusHandlers(): Promise<void> {
	if (runtimeState.handlerTasks.length > 0) {
		logInfo(`initializeMessageBusHandlers cleanup old handlers | oldRevision=${runtimeState.handlerRevision || 'n/a'} | taskCount=${runtimeState.handlerTasks.length}`);
		cleanupHandlerTasks();
	}

	registerPublicListener(TOPIC_CREATE_SYMBOL, async (payload: CreateSymbolPayload) => {
		logInfo(`message bus event | TOPIC_CREATE_SYMBOL received | session=${payload?.sessionId || 'n/a'}`);
		await handleCreateSymbol(payload);
	});

	registerPublicListener(TOPIC_CLOSE, async () => {
		logInfo('message bus event | TOPIC_CLOSE received');
		try {
			await closeGeneratorIFrames();
		}
		catch {
			// ignore
		}
	});

	runtimeState.isSessionInitialized = true;
	runtimeState.handlerRevision = HANDLER_REVISION;
	logInfo(`initializeMessageBusHandlers done | revision=${HANDLER_REVISION} | handlerTasks=${runtimeState.handlerTasks.length}`);
}

/**
 * Main entry point - opens the LED symbol generator dialog
 * Registered in extension.json headerMenus
 */
export function createLEDSymbol(): void {
	void (async () => {
		try {
			// Reset create guard so new dialog always starts clean
			runtimeState.isHandlingCreate = false;
			runtimeState.currentDialogSessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
			logInfo(`createLEDSymbol | session=${runtimeState.currentDialogSessionId}`);

			await closeGeneratorIFrames();
			await initializeMessageBusHandlers();

			await eda.sys_IFrame.openIFrame(
				'/iframe/led-symbol.html',
				520,
				720,
				GENERATOR_IFRAME_ID,
				{ maximizeButton: false, minimizeButton: false, grayscaleMask: true },
			);
			logInfo('iframe opened for createLEDSymbol');
		}
		catch (error) {
			logError(`createLEDSymbol init failed: ${String(error)}`);
		}
	})();
}

/**
 * Extension activation function
 * Called when the extension is loaded
 */
// eslint-disable-next-line unused-imports/no-unused-vars
export function activate(status?: 'onStartupFinished', arg?: string): void {
	// Activation logic handled by menu registration
}
