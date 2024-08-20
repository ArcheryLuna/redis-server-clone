import * as net from "net";
import { DatabaseSchema } from "../../types";
import { server } from "../../main";
import RDBFileLogic from "../../utils/RDBFileLogic";

export default {
    data: {
        name: "keys",
        description: "Returns all keys matching pattern."
    },
    async run( connection: net.Socket, args: any[], Data: Map<string, DatabaseSchema>, Server: server) {
        console.log(`Data Map after loading RDB file: ${JSON.stringify(Array.from(Data.entries()))}`);

        const keys = Array.from(Data.keys());

        let response = Server.RESPEncoder({
            type: "array",
            content: JSON.stringify(keys.map(key =>  ({
                type: "bulkString",
                content: key
            })))
        });

        connection.write(response)
    }
}