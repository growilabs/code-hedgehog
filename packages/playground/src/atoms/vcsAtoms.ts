import { atom } from 'jotai';

export const githubTokenAtom = atom<string>('');
export const isTokenValidAtom = atom<boolean>(false);
export const selectedOwnerAtom = atom<string>('');
export const selectedRepoAtom = atom<string>('');
