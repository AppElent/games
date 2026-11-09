/**
 * What every test needs before a module loads: an in-memory stand-in for the
 * device store, so a value written by one module is read back by the next.
 */
jest.mock("expo-sqlite/kv-store", () => {
	const store = new Map<string, string>();
	return {
		__esModule: true,
		default: {
			getItemSync: (key: string) => store.get(key) ?? null,
			setItemSync: (key: string, value: string) => {
				store.set(key, value);
			},
			removeItemSync: (key: string) => {
				store.delete(key);
			},
			clearSync: () => store.clear(),
		},
	};
});
