import * as vscode from 'vscode';
import TelemetryReporter from '@vscode/extension-telemetry';
import * as path from 'path';
import * as fs from 'fs';

// Connection string should be stored in a secure location and not hard-coded
// For development, we'll use a placeholder that you should replace with your actual connection string
const CONNECTION_STRING = ''; // Your Application Insights connection string goes here

export class TelemetryService {
    private static instance: TelemetryService;
    private reporter: TelemetryReporter | undefined;
    private extensionId: string = 'cogflows.promptcode';
    private extensionVersion: string = '0.0.0';
    private isEnabled: boolean = true; // Only used for our custom extension setting

    private constructor(context: vscode.ExtensionContext) {
        // Get extension version from package.json
        try {
            const packageJsonPath = path.join(context.extensionPath, 'package.json');
            if (fs.existsSync(packageJsonPath)) {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                this.extensionId = `${packageJson.publisher}.${packageJson.name}`;
                this.extensionVersion = packageJson.version;
            }
        } catch (error) {
            console.error('Failed to read package.json:', error);
        }

        // Initialize the telemetry reporter if we have a connection string
        if (CONNECTION_STRING) {
            this.reporter = new TelemetryReporter(CONNECTION_STRING);
            context.subscriptions.push(this.reporter);
            console.log(`Telemetry reporter initialized with connection string: ${CONNECTION_STRING ? 'present' : 'missing'}`);
        } else {
            console.log('Telemetry disabled: No connection string available');
        }

        // Check if telemetry is disabled in extension settings
        // Note: VS Code's telemetry settings are automatically respected by the reporter
        this.updateExtensionTelemetrySetting();

        // Listen for changes to the extension's settings
        context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration('promptcode.enableTelemetry')) {
                    this.updateExtensionTelemetrySetting();
                }
            })
        );
    }

    private updateExtensionTelemetrySetting(): void {
        // Get the previous value to detect changes
        const previousValue = this.isEnabled;
        
        // Always check the current configuration value
        this.isEnabled = vscode.workspace.getConfiguration('promptcode').get<boolean>('enableTelemetry', true);
        
        if (previousValue !== this.isEnabled) {
            console.log(`PromptCode telemetry setting changed: ${this.isEnabled ? 'enabled' : 'disabled'}`);
        }
    }

    public static getInstance(context?: vscode.ExtensionContext): TelemetryService {
        if (!TelemetryService.instance && context) {
            TelemetryService.instance = new TelemetryService(context);
        }
        return TelemetryService.instance;
    }

    /**
     * Send a telemetry event
     * @param eventName Name of the event
     * @param properties Additional properties to send with the event (optional)
     * @param measurements Numeric measurements to send with the event (optional)
     */
    public sendTelemetryEvent(
        eventName: string, 
        properties?: { [key: string]: string }, 
        measurements?: { [key: string]: number }
    ): void {
        // Check the current setting value before sending
        const currentSettingEnabled = vscode.workspace.getConfiguration('promptcode').get<boolean>('enableTelemetry', true);
        
        if (currentSettingEnabled && this.isEnabled && this.reporter) {
            // Add standard properties
            const allProperties = {
                ...properties,
                'timestamp': new Date().toISOString(),
                'extensionVersion': this.extensionVersion
            };
            
            this.reporter.sendTelemetryEvent(eventName, allProperties, measurements);
        }
    }

    /**
     * Send a telemetry exception
     * @param error The error object or error name
     * @param properties Additional properties to send with the event (optional)
     * @param measurements Numeric measurements to send with the event (optional)
     */
    public sendTelemetryException(
        error: Error | string, 
        properties?: { [key: string]: string }, 
        measurements?: { [key: string]: number }
    ): void {
        // Check the current setting value before sending
        const currentSettingEnabled = vscode.workspace.getConfiguration('promptcode').get<boolean>('enableTelemetry', true);
        
        if (currentSettingEnabled && this.isEnabled && this.reporter) {
            if (typeof error === 'string') {
                // Handle case where error is just a string
                this.reporter.sendTelemetryErrorEvent(error, {
                    ...properties,
                    'timestamp': new Date().toISOString(),
                    'extensionVersion': this.extensionVersion
                }, measurements);
            } else {
                // Handle case where error is an Error object
                this.reporter.sendTelemetryErrorEvent(error.name, {
                    ...properties,
                    'message': error.message,
                    'stack': error.stack || '',
                    'timestamp': new Date().toISOString(),
                    'extensionVersion': this.extensionVersion
                }, measurements);
            }
        }
    }

    /**
     * Check if our extension's telemetry is currently enabled
     * Note: This doesn't check VS Code's global setting, which is handled by the reporter
     */
    public isTelemetryEnabled(): boolean {
        // Always get the fresh value from settings
        return vscode.workspace.getConfiguration('promptcode').get<boolean>('enableTelemetry', true) && this.isEnabled;
    }
} 