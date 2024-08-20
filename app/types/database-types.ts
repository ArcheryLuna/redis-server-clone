export interface DatabaseSchema {
    key: string,
    value: any,
    expire: number
}

export interface RDBConfig {
    dir: string,
    dbfilename: string
}