import * as net from "net";
import { DatabaseSchema, RedisEntry } from "../../types";
import { server } from "../../main";

export default {
    data: {
        name: "get",
        description: "This command gets data from the database"
    },
    async run(connection: net.Socket, args: any[], Data: Map<string, RedisEntry>, Server: server) {
        if (args.length < 1) {
            connection.write("-Error: No arguments were parsed\r\n");
            return;
        }

        const key = args[0];
        const value = Data.get(key);

        if (!value) {
            connection.write("$-1\r\n"); // Key not found
            return;
        }

        const currentTime = Date.now();

        if (typeof value.expiration === 'number') {
            if (value.expiration <= currentTime) {
                Data.delete(key);
                connection.write("$-1\r\n"); // Key expired
                return;
            }
        }

        connection.write(`+${value.value}\r\n`);
    }
}
