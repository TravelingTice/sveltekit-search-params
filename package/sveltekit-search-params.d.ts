/// <reference types="svelte" />
import { type Writable } from 'svelte/store';
export type EncodeAndDecodeOptions<T = any> = {
    encode: (value: T) => string | undefined;
    decode: (value: string | null) => T | null;
    defaultValue?: T;
};
export type StoreOptions<T> = {
    debounceHistory?: number;
    pushHistory?: boolean;
    sort?: boolean;
    showDefaults?: boolean;
    equalityFn?: T extends object ? (current: T | null, next: T | null) => boolean : never;
};
type LooseAutocomplete<T> = {
    [K in keyof T]: T[K];
} & {
    [K: string]: any;
};
type Options<T> = {
    [Key in keyof T]: EncodeAndDecodeOptions<T[Key]> | boolean;
};
export declare const ssp: {
    object: <T extends object = any>(defaultValue?: T | undefined) => {
        encode: (value: T) => string;
        decode: (value: string | null) => T | null;
        defaultValue: T | undefined;
    };
    array: <T_1 = any>(defaultValue?: T_1[] | undefined) => {
        encode: (value: T_1[]) => string;
        decode: (value: string | null) => T_1[] | null;
        defaultValue: T_1[] | undefined;
    };
    number: (defaultValue?: number) => {
        encode: (value: number) => string;
        decode: (value: string | null) => number | null;
        defaultValue: number | undefined;
    };
    boolean: (defaultValue?: boolean) => {
        encode: (value: boolean) => string;
        decode: (value: string | null) => boolean;
        defaultValue: boolean | undefined;
    };
    string: (defaultValue?: string) => {
        encode: (value: string | null) => string;
        decode: (value: string | null) => string | null;
        defaultValue: string | undefined;
    };
    lz: <T_2 = any>(defaultValue?: T_2 | undefined) => {
        encode: (value: T_2) => string;
        decode: (value: string | null) => T_2 | null;
        defaultValue: T_2 | undefined;
    };
};
export declare function queryParameters<T extends object>(options?: Options<T>, { debounceHistory, pushHistory, sort, showDefaults, equalityFn, }?: StoreOptions<T>): Writable<LooseAutocomplete<T>>;
export declare function queryParam<T = string>(name: string, { encode: encode, decode: decode, defaultValue, }?: EncodeAndDecodeOptions<T>, { debounceHistory, pushHistory, sort, showDefaults, equalityFn, }?: StoreOptions<T>): Writable<T | null>;
export {};
