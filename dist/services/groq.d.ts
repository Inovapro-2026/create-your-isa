export interface ClientConfig {
    client_id: string;
    personality: string;
    tone: string;
    formality_level: string;
    allowed_emojis: string[];
    products_knowledge: any[];
    faqs: any[];
    behavior_rules: string[];
    active_triggers: any[];
}
export declare class GroqService {
    private getClientConfig;
    private buildPrompt;
    generateResponse(clientId: string, userMessage: string, context?: any): Promise<string>;
}
declare const _default: GroqService;
export default _default;
