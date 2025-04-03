import commandLineArgs from 'command-line-args'
import commandLineUsage from 'command-line-usage'
import { runStart } from './start.js'
import { getApiKey } from "./apikey.js";

const mainDefinitions = [
    {name: 'command', defaultOption: true},
    {name: 'apiKey', alias: 'k',defaultValue: getApiKey(), type: String},
    {name: 'host', alias: 'H', defaultValue: "https://app.sentio.xyz", type: String},
    {name: 'help', alias: 'h', type: Boolean}
]

const mainUsage = [
    {
        header: 'Sentio Api MCP',
        content: 'Sentio Api MCP'
    },
    {
        header: 'Options',
        optionList: [
            {name: 'help', description: 'Show help'},
            {name: 'api-key', alias: 'k', description: 'API key'},
            {name: 'token', alias: 't', description: 'jwt token'},
            {name: 'host', alias: 'H', description: 'Host'},
        ]
    }  
]

const mainOptions = commandLineArgs(mainDefinitions, {stopAtFirstUnknown: true})
const argv = mainOptions._unknown || []
const usage = commandLineUsage(mainUsage)

if (mainOptions.help){
    console.log(usage)
} else {
    runStart(argv, mainOptions)
}