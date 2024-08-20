export function RESPEncoder({ type, content }: {
    type: "simpleString" | "simpleError" | "int" | "bulkString" | "array" | "null" | "bool" | "double" | "bigNumber" | "bulkError" | "verbatimStrings" | "maps" | "sets" | "pushes",
    content: string
}): string {
    switch (type) {
        case "simpleString":
            return `+${content}\r\n`;
        case "simpleError":
            return `-${content}\r\n`;
        case "int":
            return `:${content}\r\n`;
        case "bulkString":
            if (content === null) {
                return `$-1\r\n`;
            } else {
                return `$${content.length}\r\n${content}\r\n`;
            }
        case "array":
            const arrayItems = JSON.parse(content) as any[];
            if (!Array.isArray(arrayItems)) throw new Error("Content must be an array for RESP array type");
            return `*${arrayItems.length}\r\n${arrayItems.map(item => RESPEncoder(item)).join('')}`;
        case "null":
            return `_$-1\r\n`;
        case "bool":
            return content === "true" ? `#t\r\n` : `#f\r\n`;
        case "double":
            return `,${content}\r\n`;
        case "bigNumber":
            return `(${content}\r\n`;
        case "bulkError":
            return `!${content.length}\r\n${content}\r\n`;
        case "verbatimStrings":
            return `=${content.length}\r\n${content}\r\n`;
        case "maps":
            const mapItems = JSON.parse(content) as Record<string, string>;
            const mapEntries = Object.entries(mapItems);
            return `%${mapEntries.length}\r\n${mapEntries.map(([key, value]) => RESPEncoder({ type: "bulkString", content: key }) + RESPEncoder({ type: "bulkString", content: value })).join('')}`;
        case "sets":
            const setItems = JSON.parse(content) as string[];
            if (!Array.isArray(setItems)) throw new Error("Content must be an array for RESP sets type");
            return `~${setItems.length}\r\n${setItems.map(item => RESPEncoder({ type: "bulkString", content: item })).join('')}`;
        case "pushes":
            const pushItems = JSON.parse(content) as any[];
            if (!Array.isArray(pushItems)) throw new Error("Content must be an array for RESP pushes type");
            return `>${pushItems.length}\r\n${pushItems.map(item => RESPEncoder(item)).join('')}`;
        default:
            return "-Error: Unknown RESP type\r\n";
    }
}
