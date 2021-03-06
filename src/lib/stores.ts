import { browser } from '$app/env';
import { DATA_PREFIX } from '$lib/constants';
import { writable, get } from 'svelte/store';
import type { CategoriesIndex, CategoriesIndexItem, SearchIndex } from '$lib/types';

export type SortedSearchIndexes = {
	weeklyInstalls: SearchIndex;
	totalInstalls: SearchIndex;
	rating: SearchIndex;
	updated: SearchIndex;
	created: SearchIndex;
	categories: CategoriesIndex;
};

export const styleIndex = fetchOnce<SortedSearchIndexes>(() =>
	fetch(`${DATA_PREFIX}/search-index.json`).then((resp) => resp.json().then((e) => sort(e)))
);

function getCategories(weeklyInstalls: SearchIndex): CategoriesIndex {
	const categories: { [key: string]: CategoriesIndexItem } = {};
	for (const style of weeklyInstalls) {
		if (categories[style.c] === undefined) {
			categories[style.c] = { n: style.c, s: [style] };
		} else {
			categories[style.c].s.push(style);
		}
	}

	const arr = [];
	for (const key in categories) {
		arr.push(categories[key]);
	}
	arr.sort((a, b) => b.s.length - a.s.length);

	return arr;
}

function sort(weeklyInstalls: SearchIndex): SortedSearchIndexes {
	return {
		weeklyInstalls,
		totalInstalls: [...weeklyInstalls].sort((a, b) => b.t - a.t),
		rating: [...weeklyInstalls].sort((a, b) => b.r - a.r),
		updated: [...weeklyInstalls].sort((a, b) => b.u - a.u),
		created: [...weeklyInstalls].sort((a, b) => b.i - a.i),
		categories: getCategories(weeklyInstalls)
	};
}

type DataType<T> = { isLoading: boolean; error?: Error; data?: T };
type HandlerType<T> = (value: { isLoading: boolean; error?: Error; data?: T }) => void;

export function fetchOnce<T>(
	promiseFn: any, // eslint-disable-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
	initialValue: DataType<T> = { isLoading: false }
): { subscribe: (handler: HandlerType<T>) => () => void } {
	let _value = initialValue;
	const subs = [];

	function subscribe(handler: HandlerType<T>): () => void {
		subs.push(handler);

		if (_value === initialValue && !_value.isLoading && browser) {
			_value.isLoading = true;
			const t = promiseFn();
			if (t instanceof Promise) {
				t.then((data: T) => {
					set({ isLoading: false, error: null, data });
				}).catch((e: Error) => {
					set({ isLoading: false, error: e, data: null });
				});
			} else {
				set({ isLoading: false, error: null, data: t });
			}
		}

		handler(_value);

		return () => subs.splice(subs.indexOf(handler));
	}

	function set(value: DataType<T>) {
		if (_value === value) return;

		_value = value;
		subs.forEach((s) => s(_value));
	}

	return { subscribe };
}

export function createAwaiter<T>(promise: Promise<T>) {
	const { subscribe, set } = writable({ isLoading: true, error: null, data: null });
	
	_set(promise);

	function _set(promise: Promise<T>) {
		promise.then(data => set({ isLoading: false, error: null, data }), error => set({ isLoading: false, error, data: null }))
	}

	return {
		subscribe,
		set: _set
	};
}

function prefersDarkColorScheme(): boolean {
	return window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)').matches : false;
}

function setDarkClass(value: boolean) {
	if (value) {
		document.documentElement.classList.add('dark');
	} else {
		document.documentElement.classList.remove('dark');
	}
}

function getDarkTheme() {
	const prevValue = localStorage.getItem('dark-theme');

	if (prevValue) {
		const value: boolean = JSON.parse(prevValue);
		return value;
	} else {
		return prefersDarkColorScheme();
	}
}

function setDarkTheme(value: boolean) {
	if (value === prefersDarkColorScheme()) localStorage.removeItem('dark-theme');
	else localStorage.setItem('dark-theme', JSON.stringify(value));
	setDarkClass(value);
}

function createDarkTheme() {
	const store = writable(false);
	const { subscribe, set, update } = store;

	return {
		subscribe,
		set(value: boolean) {
			setDarkTheme(value);
			set(value);
		},
		update(updater: Parameters<typeof update>[0]) {
			const value = updater(get(store));
			setDarkTheme(value);
			set(value);
		},
		sync() {
			const value = getDarkTheme();
			setDarkClass(value);
			set(value);
		}
	};
}

export const darkTheme = createDarkTheme();
