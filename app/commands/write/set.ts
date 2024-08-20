import * as net from "net";
import { DatabaseSchema } from "../../types";
import { server } from "../../main"

export default {
    data: {
        name: "set",
        description: "This command sets data into the database"
    },
    async run(connection: net.Socket, args: any[], Data: Map<string, DatabaseSchema>, Server: server) {
        if (args.length < 2) {
            connection.write("-Error: No arguments were parsed\r\n");
            return;
        }

        const [key, value, modifier, modifierValue] = args;

        let existingData = Data.get(key);
        let expireTime = 0;

        if (modifier) {
            const currentTime = Date.now();

            switch (modifier.toLowerCase()) {
                case "ex": // Seconds
                    expireTime = currentTime + (parseInt(modifierValue) * 1000);
                    break;
                case "px": // Milliseconds
                    expireTime = currentTime + parseInt(modifierValue);
                    break;
                case "exat": // timestamp-seconds
                    expireTime = parseInt(modifierValue) * 1000;
                    break;
                case "pxat": // timestamp-milliseconds
                    expireTime = parseInt(modifierValue);
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
                        expireTime = existingData.expire;
                    }
                    break;
                case "get": // Return the old value stored at key before setting the new value
                    if (existingData) {
                        connection.write(`$${existingData.value.length}\r\n${existingData.value}\r\n`);
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
            key: key,
            value: value,
            expire: expireTime
        });

        connection.write("+OK\r\n");
    }
}
