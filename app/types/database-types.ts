export interface DatabaseSchema {
    [key: string]: RedisEntry;
}

export interface RedisEntry {
    value: RedisValue;
    expiration?: number; // Expiration timestamp in milliseconds (optional)
}

export type RedisValue = RedisString | RedisList | RedisSet | RedisSortedSet | RedisHash;

export type RedisString = string;

export type RedisList = string[];

export type RedisSet = Set<string>;

export interface RedisSortedSetEntry {
    value: string;
    score: number;
}

export type RedisSortedSet = RedisSortedSetEntry[];

export interface RedisHash {
    [field: string]: string;
}

export interface RDBConfig {
    dir: string,
    dbfilename: string
}