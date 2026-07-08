export type InFlightRequestCache = {
    run<T>(key: string, loader: () => Promise<T>): Promise<T>;
    clear(key?: string): void;
};

export function createInFlightRequestCache(): InFlightRequestCache {
    const requests = new Map<string, Promise<unknown>>();

    return {
        run<T>(key: string, loader: () => Promise<T>): Promise<T> {
            const existing = requests.get(key);
            if (existing) {
                return existing as Promise<T>;
            }

            const next = loader().finally(() => {
                requests.delete(key);
            });

            requests.set(key, next);
            return next;
        },
        clear(key?: string) {
            if (key) {
                requests.delete(key);
                return;
            }
            requests.clear();
        },
    };
}
