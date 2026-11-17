type MysqlErrorShape = {
 code?: unknown;
 sqlState?: unknown;
};

function mysqlErrorShape(error: unknown): MysqlErrorShape | undefined {
 if (typeof error !== 'object' || error === null) return undefined;
 return error as MysqlErrorShape;
}

export function hasMysqlError(error: unknown, code: string): boolean {
 return mysqlErrorShape(error)?.code === code;
}

export function hasMysqlSqlState(error: unknown, sqlState: string): boolean {
 return mysqlErrorShape(error)?.sqlState === sqlState;
}
