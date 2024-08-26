import * as net from "net";
import { DatabaseSchema } from "../../types";
import { server } from "../../main";
import { RESPEncoder } from "../../utils/RESPEncoder"; 

// Basic pattern matching function
function matchPattern(pattern: string, key: string): boolean {
    const regexPattern = pattern
        .replace(/[-[\]{}()+?.,\\^$|#\s]/g, '\\$&') // Escape special characters
        .replace(/\*/g, '.*')                      // Convert '*' to '.*'
        .replace(/\?/g, '.')                       // Convert '?' to '.'
        .replace(/\[!(.*?)\]/g, '[^$1]')           // Convert '[!abc]' to '[^abc]'
        .replace(/\[([^\]]+)\]/g, '[$1]');         // Keep '[abc]' and '[a-z]' as is

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(key);
}

export default {
    data: {
        name: "keys",
        description: "Returns all keys matching pattern."
    },
    async run(connection: net.Socket, args: any[], Data: Map<string, DatabaseSchema>, Server: server) {
        const pattern = args[0];

        const allKeys: string[] = [];

        // Iterate over the entire Data map
        Data.forEach((dbSchema, dbIndex) => {
            for (const key in dbSchema) {
                // Match key against pattern using the custom matchPattern function
                if (matchPattern(pattern, key)) {
                    allKeys.push(key);
                }
            }
        });

        // Encode the response as a RESP array
        const response = RESPEncoder({
            type: "array",
            content: JSON.stringify(allKeys.map(key => ({ type: "bulkString", content: key }))),
        });

        // Send the response
        connection.write(response);
    }
}