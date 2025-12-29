export declare class SessionManager {
    private sessions;
    constructor();
    startSession(clientId: string): Promise<{
        status: string;
        sessionId: string;
    }>;
    getSessionStatus(clientId: string): Promise<{
        dbStatus: any;
        isConnected: boolean;
    }>;
    stopSession(clientId: string): Promise<void>;
    resetSession(clientId: string): Promise<void>;
    private setupMessageListener;
    private updateSessionStatus;
    private updateSessionQr;
    private updateSessionPhoneInfo;
    private logMessage;
}
declare const _default: SessionManager;
export default _default;
