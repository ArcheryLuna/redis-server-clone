import * as net from "net";
import { DatabaseSchema, RedisEntry, RedisValue } from "../../types";
import { server } from "../../main"

export default {
    data: {
        name: "set",
        description: "This command sets data into the database"
    },
    async run(connection: net.Socket, args: any[], Data: Map<string, RedisEntry>, Server: server) {
        if (args.length < 2) {
            connection.write("-Error: No arguments were parsed\r\n");
            return;
        }

        const [key, value, modifier, modifierValue] = args;

        let existingData = Data.get(key);
        let expiration: number | undefined = undefined;

        if (modifier) {
            const currentTime = Date.now();

            switch (modifier.toLowerCase()) {
                case "ex": // Seconds
                    expiration = currentTime + (parseInt(modifierValue) * 1000);
                    break;
                case "px": // Milliseconds
                    expiration = currentTime + parseInt(modifierValue);
                    break;
                case "exat": // timestamp-seconds
                    expiration = parseInt(modifierValue) * 1000;
                    break;
                case "pxat": // timestamp-milliseconds
                    expiration = parseInt(modifierValue);
                    break;
                case "nx": // Only set the key if it does not already exist
                    if (existingData) {
                        connection.write("-Error: Key already exists\r\n");
                        return;
                    }
                    break;
                case "xx": // Only set the key if it already exists
                    if (!existingData) {
                        connection.write("-Error: Key does not exist\r\n");
                        return;
                    }
                    break;
                case "keepttl": // Retain the time to live associated with the key
                    if (existingData) {
                        expiration = existingData.expiration;
                    }
                    break;
                case "get": // Return the old value stored at key before setting the new value
                    if (existingData) {
                        const valueToReturn = existingData.value;
                        if (typeof valueToReturn === 'string' || Array.isArray(valueToReturn)) {
                            connection.write(`$${valueToReturn.length}\r\n${valueToReturn}\r\n`);
                        } else if (valueToReturn instanceof Set) {
                            connection.write(`$${valueToReturn.size}\r\n${Array.from(valueToReturn).join(',')}\r\n`);
                        } else if (typeof valueToReturn === 'object') {
                            connection.write(`$${Object.keys(valueToReturn).length}\r\n${JSON.stringify(valueToReturn)}\r\n`);
                        } else {
                            connection.write("$-1\r\n");
                        }
                    } else {
                        connection.write("$-1\r\n");
                    }
                    break;
                default:
                    connection.write("-Error: Unknown modifier\r\n");
                    return;
            }
        }

        Data.set(key, {
            value: value,
            expiration: expiration
        });

        connection.write("+OK\r\n");
    }
}
