type RollupWarning = {
    code?: string;
    message: string;
};
type WarningHandler = (warning: RollupWarning) => void;
export declare function createElectronExternals(dependencies?: Record<string, string>): string[];
export declare function onElectronRollupWarning(warning: RollupWarning, warn: WarningHandler): void;
export {};
