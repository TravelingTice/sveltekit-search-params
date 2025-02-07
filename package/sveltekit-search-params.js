/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { browser, building } from '$app/environment';
import { goto } from '$app/navigation';
import { navigating, page as page_store } from '$app/stores';
import { derived, get, writable, readable, } from 'svelte/store';
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent, } from './lz-string/index.js';
// during building we fake the page store with an URL with no search params
// as it should be during prerendering. This allow the application to still build
// and the client side behavior is still persisted after the build
let page;
if (building) {
    page = readable({
        url: new URL('https://github.com/paoloricciuti/sveltekit-search-params'),
    });
}
else {
    page = page_store;
}
const GOTO_OPTIONS = {
    keepFocus: true,
    noScroll: true,
    replaceState: true,
};
const GOTO_OPTIONS_PUSH = {
    keepFocus: true,
    noScroll: true,
    replaceState: false,
};
function mixSearchAndOptions(searchParams, overrides, options) {
    const uniqueKeys = Array.from(new Set(Array.from(searchParams?.keys?.() || []).concat(Object.keys(options ?? {}))));
    let anyDefaultedParam = false;
    return [
        Object.fromEntries(uniqueKeys.map((key) => {
            if (overrides[key] != undefined) {
                return [key, overrides[key]];
            }
            let fnToCall = (value) => value;
            const optionsKey = options?.[key];
            if (typeof optionsKey !== 'boolean' &&
                typeof optionsKey?.decode === 'function') {
                fnToCall = optionsKey.decode;
            }
            const value = searchParams?.get(key);
            let actualValue;
            if (value == undefined &&
                optionsKey?.defaultValue != undefined) {
                actualValue = optionsKey.defaultValue;
                anyDefaultedParam = true;
            }
            else {
                actualValue = fnToCall(value);
            }
            return [key, actualValue];
        })),
        anyDefaultedParam,
    ];
}
function isComplexEqual(current, next, equalityFn = (current, next) => JSON.stringify(current) === JSON.stringify(next)) {
    return (typeof current === 'object' &&
        typeof next === 'object' &&
        equalityFn(current, next));
}
export const ssp = {
    object: (defaultValue) => ({
        encode: (value) => JSON.stringify(value),
        decode: (value) => {
            if (value === null)
                return null;
            try {
                return JSON.parse(value);
            }
            catch (e) {
                return null;
            }
        },
        defaultValue,
    }),
    array: (defaultValue) => ({
        encode: (value) => JSON.stringify(value),
        decode: (value) => {
            if (value === null)
                return null;
            try {
                return JSON.parse(value);
            }
            catch (e) {
                return null;
            }
        },
        defaultValue,
    }),
    number: (defaultValue) => ({
        encode: (value) => value.toString(),
        decode: (value) => (value ? parseFloat(value) : null),
        defaultValue,
    }),
    boolean: (defaultValue) => ({
        encode: (value) => value + '',
        decode: (value) => value !== null && value !== 'false',
        defaultValue,
    }),
    string: (defaultValue) => ({
        encode: (value) => value ?? '',
        decode: (value) => value,
        defaultValue,
    }),
    lz: (defaultValue) => ({
        encode: (value) => compressToEncodedURIComponent(JSON.stringify(value)),
        decode: (value) => {
            if (!value)
                return null;
            try {
                return JSON.parse(decompressFromEncodedURIComponent(value) ?? '');
            }
            catch (e) {
                return null;
            }
        },
        defaultValue,
    }),
};
const batchedUpdates = new Set();
let batchTimeout;
const debouncedTimeouts = new Map();
export function queryParameters(options, { debounceHistory = 0, pushHistory = true, sort = true, showDefaults = true, equalityFn, } = {}) {
    const overrides = writable({});
    let currentValue;
    let firstTime = true;
    function _set(value, changeImmediately) {
        if (!browser)
            return;
        firstTime = false;
        const hash = window.location.hash;
        const query = new URLSearchParams(window.location.search);
        const toBatch = (query) => {
            for (const field of Object.keys(value)) {
                if (value[field] == undefined) {
                    query.delete(field);
                    continue;
                }
                let fnToCall = (value) => value.toString();
                const optionsKey = options?.[field];
                if (typeof optionsKey !== 'boolean' &&
                    typeof optionsKey?.encode === 'function') {
                    fnToCall = optionsKey.encode;
                }
                const newValue = fnToCall(value[field]);
                if (newValue == undefined) {
                    query.delete(field);
                }
                else {
                    query.set(field, newValue);
                }
            }
        };
        batchedUpdates.add(toBatch);
        clearTimeout(batchTimeout);
        batchTimeout = setTimeout(async () => {
            batchedUpdates.forEach((batched) => {
                batched(query);
            });
            clearTimeout(debouncedTimeouts.get('queryParameters'));
            if (browser) {
                overrides.set(value);
                // eslint-disable-next-line no-inner-declarations
                async function navigate() {
                    if (sort) {
                        query.sort();
                    }
                    await goto(`?${query}${hash}`, pushHistory ? GOTO_OPTIONS_PUSH : GOTO_OPTIONS);
                    overrides.set({});
                }
                if (changeImmediately || debounceHistory === 0) {
                    navigate();
                }
                else {
                    debouncedTimeouts.set('queryParameters', setTimeout(navigate, debounceHistory));
                }
            }
            batchedUpdates.clear();
        });
    }
    const { subscribe } = derived([page, overrides], ([$page, $overrides], set) => {
        const [valueToSet, anyDefaultedParam] = mixSearchAndOptions($page?.url?.searchParams, $overrides, options);
        if (anyDefaultedParam && showDefaults) {
            _set(valueToSet, firstTime);
        }
        if (isComplexEqual(currentValue, valueToSet, equalityFn)) {
            return;
        }
        currentValue = structuredClone(valueToSet);
        return set(valueToSet);
    });
    return {
        set(newValue) {
            _set(newValue);
        },
        subscribe,
        update: (updater) => {
            const currentValue = get({ subscribe });
            const newValue = updater(currentValue);
            _set(newValue);
        },
    };
}
const DEFAULT_ENCODER_DECODER = {
    encode: (value) => value.toString(),
    decode: (value) => (value ? value.toString() : null),
};
export function queryParam(name, { encode: encode = DEFAULT_ENCODER_DECODER.encode, decode: decode = DEFAULT_ENCODER_DECODER.decode, defaultValue, } = DEFAULT_ENCODER_DECODER, { debounceHistory = 0, pushHistory = true, sort = true, showDefaults = true, equalityFn, } = {}) {
    const override = writable(null);
    let firstTime = true;
    let currentValue;
    let isNavigating = false;
    if (browser) {
        navigating.subscribe((nav) => {
            isNavigating = nav?.type === 'goto';
        });
    }
    function _set(value, changeImmediately) {
        if (!browser)
            return;
        // Wait for previous navigation to be finished before updating again
        if (isNavigating) {
            const unsubscribe = navigating.subscribe((nav) => {
                if (nav?.type !== 'goto') {
                    _set(value, changeImmediately);
                    unsubscribe();
                }
            });
            return;
        }
        firstTime = false;
        const hash = window.location.hash;
        const toBatch = (query) => {
            if (value == undefined) {
                query.delete(name);
            }
            else {
                const newValue = encode(value);
                if (newValue == undefined) {
                    query.delete(name);
                }
                else {
                    query.set(name, newValue);
                }
            }
        };
        batchedUpdates.add(toBatch);
        clearTimeout(batchTimeout);
        const query = new URLSearchParams(window.location.search);
        batchTimeout = setTimeout(async () => {
            batchedUpdates.forEach((batched) => {
                batched(query);
            });
            clearTimeout(debouncedTimeouts.get(name));
            if (browser) {
                override.set(value);
                // eslint-disable-next-line no-inner-declarations
                async function navigate() {
                    if (sort) {
                        query.sort();
                    }
                    await goto(`?${query}${hash}`, pushHistory ? GOTO_OPTIONS_PUSH : GOTO_OPTIONS);
                    override.set(null);
                }
                if (changeImmediately || debounceHistory === 0) {
                    navigate();
                }
                else {
                    debouncedTimeouts.set(name, setTimeout(navigate, debounceHistory));
                }
            }
            batchedUpdates.clear();
        });
    }
    const { subscribe } = derived([page, override], ([$page, $override], set) => {
        if ($override != undefined) {
            if (isComplexEqual(currentValue, $override, equalityFn)) {
                return;
            }
            currentValue = structuredClone($override);
            return set($override);
        }
        const actualParam = $page?.url?.searchParams?.get?.(name);
        if (actualParam == undefined && defaultValue != undefined) {
            if (showDefaults) {
                _set(defaultValue, firstTime);
            }
            if (isComplexEqual(currentValue, defaultValue, equalityFn)) {
                return;
            }
            currentValue = structuredClone(defaultValue);
            return set(defaultValue);
        }
        const retval = decode(actualParam);
        if (isComplexEqual(currentValue, retval, equalityFn)) {
            return;
        }
        currentValue = structuredClone(retval);
        return set(retval);
    });
    return {
        set(newValue) {
            _set(newValue);
        },
        subscribe,
        update: (updater) => {
            const newValue = updater(currentValue);
            _set(newValue);
        },
    };
}
