declare module 'better-sqlite3' {
	export interface Database {
		prepare?: (...args: any[]) => any;
		exec?: (...args: any[]) => any;
		close?: (...args: any[]) => any;
	}
	const Database: {
		new (...args: any[]): Database;
	};
	namespace Database {
		export type Database = any;
	}
	export default Database;
}