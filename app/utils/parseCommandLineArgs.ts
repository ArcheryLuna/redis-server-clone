export function parseCommandLineArgs() {
    const args = process.argv.slice(2);
    const options: { [key: string]: string } = {};

    for (let i = 0; i < args.length; i += 2) {
        const key = args[i];
        const value = args[i+1];
        
        if (key.startsWith("--")) {
            options[key.slice(2)] = value;
        }
    }

    return options;
}