#!/bin/env node

import { program } from "commander"
import { existsSync, mkdir, copyFile, rm, readdirSync, stat, statSync, rmSync, readFileSync, writeFileSync } from "fs"
import inquirer from "inquirer"
import chalk from "chalk"

var CURRENT_ID = 0
function nextID() {
    return CURRENT_ID++
}

async function backup() {
    // We want to copy the entirety of the `content` folder to the `content-backup` folder in the same folder as the `content` folder

    const STIFolder = await getSTIFolder()
    const contentFolder = `${STIFolder}/content`
    // The backup folder includes the current time so we know which one is the latest backup
    const backupFolder = `${STIFolder}/content-backup-${new Date().toISOString().replace(/:/g, "-")}`

    // Check if the backup folder exists, if not, create it. If it does, ask if we should overwrite it
    if (!existsSync(backupFolder)) {
        console.log(chalk.green(`Creating backup folder at ${backupFolder}`))
        await mkdir(backupFolder, { recursive: true }, (err) => { if (err) console.log(chalk.red(`Error creating backup folder at ${backupFolder}: ${err}`)) }) 
    } else {
        console.log(chalk.yellow(`Backup folder already exists at ${backupFolder}`))
        const overwrite = await inquirer.prompt({
            type: 'confirm',
            name: 'overwrite',
            message: 'Do you want to overwrite the backup folder?',
            default: false
        })
        if (overwrite.overwrite) {
            console.log(chalk.green(`Overwriting backup folder at ${backupFolder}`))
            rmSync(backupFolder, { recursive: true, force: true }, (err) => {
                if (err) {
                    console.log(chalk.red(`Error deleting backup folder at ${backupFolder}: ${err}`))
                }})
            await mkdir(backupFolder, (err) => { if (err) console.log(chalk.red(`Error creating backup folder at ${backupFolder}: ${err}`)) })
        } else {
            console.log(chalk.red(`Not overwriting backup folder at ${backupFolder}`))
            console.log(chalk.red(`No backup has been made.`))
            return
        }
    }

    // Copy the content folder to the backup folder
    console.log(chalk.green(`Copying ${contentFolder} to ${backupFolder}`))
    await copyFolder(contentFolder, backupFolder)

    console.log(chalk.green(`Backup complete! Make sure to rename ${backupFolder} to something easy to remember, so you know what to reload when you need to.`))
}

async function copyFolder(src, dst) {
    // Recursively copy every file in src to dst
    const files = readdirSync(src, (err) => { if (err) console.log(chalk.red(`Error reading folder ${src}: ${err}`)) })
    for (const file of files) {
        const srcFile = `${src}/${file}`
        const dstFile = `${dst}/${file}`
        const srcStat = statSync(srcFile, (err) => { if (err) console.log(chalk.red(`Error reading file ${srcFile}: ${err}`)) })
        if (srcStat.isDirectory()) {
            await mkdir(dstFile, (err) => { if (err) console.log(chalk.red(`Error creating new folder at ${dstFile}: ${err}`)) })
            await copyFolder(srcFile, dstFile)
        } else {
            await copyFile(srcFile, dstFile, (err) => { if (err) console.log(chalk.red(`Error creating backup at ${dstFile}: ${err}`)) })
        }
    }
}

async function getSTIFolder() {
    // Thank fucking christ that Windows interpolates \ instead of /

    // We are looking for the SurviveTheInternet folder, we could be in one of the following:
    //  - In the SurviveTheInternet folder, just stay there
    //  - A child folder of the folder, from where we go up until we find SurviveTheInternet
    //  - In the games folder, from where we just go into SurviveTheInternet
    //  - In the Party Pack 4 folder, in which case the folder games must exist, from where we go in games/SurviveTheInternet
    //  - In any other folder, in which we'll ask for the Party Pack 4 folder

    // Check for which state we are in
    if (existsSync(`${process.cwd()}/../SurviveTheInternet`)) {
        return `${process.cwd()}`
    } else if (existsSync(`${process.cwd()}/../games`)) {
        return `${process.cwd()}/SurviveTheInternet`
    } else if (existsSync(`${process.cwd()}/games`)) {
        return `${process.cwd()}/games/SurviveTheInternet`
    } else {
        let userInput = await inquirer.prompt(
            {
                name: "sti_folder",
                type: "input",
                message: `Where is your ${chalk.bgCyan("SurviveTheInternet")} folder?`,
                default() {
                    return process.platform == "win32" ?
                    'C:\\Program Files(x86)\\Steam\\steamapps\\common\\The Jackbox Party Pack 4\\games\\SurviveTheInternet' :
                    '~/.steam/steam/steamapps/common/The Jackbox Party Pack 4/games/SurviveTheInternet'
                }
            }
        )
        
        // Check if this is the right folder by seeing if it contains the 'content' folder
        if (existsSync(`${userInput.sti_folder}/content`)) {
            return userInput.sti_folder
        }
        // If not, write an error message and exit
        console.error(`${chalk.bgRed(userInput.sti_folder)} does not contain the 'content' folder, are you sure this is the right folder?`)
    }

}

async function getMods() {
    // We want to get all of the mods from the `mods` folder inside of the STI folder
    const STIFolder = await getSTIFolder()
    const modsFolder = `${STIFolder}/mods`

    // Check if the mods folder exists, if not, create it. If it does, do nothing
    if (!existsSync(modsFolder)) {
        console.log(chalk.green(`Creating mods folder at ${modsFolder}`))
        await mkdir(modsFolder, { recursive: true }, (err) => { if (err) console.log(chalk.red(`Error creating mods folder at ${modsFolder}: ${err}`)) }) 
    }

    // Get all of the files in the mods folder
    const files = readdirSync(modsFolder, (err) => { if (err) console.log(chalk.red(`Error reading folder ${modsFolder}: ${err}`)) })

    // Try to load them all as a mod
    var mods = []
    for (const file of files) {
        const mod = Mod.fromFile(`${modsFolder}/${file}`)
        if (mod) {
            mods.push(mod)
        }
    }

    // Remove any mods that are not valid
    mods = mods.filter(mod => mod != null)

    return mods;
}

async function getModsByFile(file) {
    return (await getMods()).filter(mod => mod.targetFile == file)
}

async function initFile(file) {
    // Get the mods relating to this file
    const mods = await getModsByFile(file)

    // Create a new ContentFile in which we will write our modded file
    const contentFile = new ContentFile()

    // Set the episode ID based on the file name
    switch (file) {
        case "STIJobPrompt.jet":
            contentFile.episodeid = 1322
            break
        case "STIPrompt.jet":
            contentFile.episodeid = 1311
            break
        case "STIStorePrompt.jet":
            contentFile.episodeid = 1314
            break
    }
    
    contentFile.content = []

    // Loop for every mod in the file
    for (const mod of mods) {
        for (const prompt of mod.promptsAdded) {
            contentFile.content.push(Prompt.fromModPrompt(prompt))
        }

    }

    return contentFile
}

async function writeMods() {
    // Get the content folder
    const contentFolder = await getSTIFolder() + "/content"
    // List of currently supported files
    const files = [
        "STIJobPrompt.jet",
        "STIPrompt.jet",
        "STIStorePrompt.jet"
    ]

    // Loop for every file
    for (const file of files) {
        // Get the content file
        const contentFile = await initFile(file)
        // JSONify the content file
        const json = JSON.stringify(contentFile, null, 4)
        // Write the JSON to the file in the content folder
        writeFileSync(`${contentFolder}/${file}`, json, (err) => { if (err) console.log(chalk.red(`Error writing file ${contentFolder}/${file}: ${err}`)) })
    }
}

async function install() {
    await backup()
    await writeMods()
}

async function backupContentAsMods() {
    // Get the content folder
    const contentFolder = await getSTIFolder() + "/content"
    // List of currently supported files
    const files = [
        "STIJobPrompt.jet",
        "STIPrompt.jet",
        "STIStorePrompt.jet"
    ]

    

    // Loop for every file
    for (const file of files) {
        // Create a new mod
        var mod = new Mod()
        
        // Read the content file and parse it as JSON
        const json = readFileSync(`${contentFolder}/${file}`, (err) => { if (err) console.log(chalk.red(`Error reading file ${contentFolder}/${file}: ${err}`)) })
        const contentFile = JSON.parse(json)


        // Loop for every prompt in the content file
        for (const prompt of contentFile.content) {
            mod.promptsAdded.push(ModPrompt.fromPrompt(prompt))
        }

        // Add metadata
        mod.name = "Content backup of " + file + " as of " + new Date().toLocaleString()
        mod.targetFile = "STIPrompt.jet"
        mod.author = "Jackbox games"
        

        // Write the mod to the mods folder
        const modsFolder = await getSTIFolder() + "/mods"
        const modFile = `${modsFolder}/${file}-backup-${new Date().toISOString().replace(/:/g, "-")}.sti`
        const modjson = JSON.stringify(mod, null, 4)
        writeFileSync(modFile, modjson, (err) => { if (err) console.log(chalk.red(`Error writing file ${modFile}: ${err}`)) })
    }

    
}

class Mod {
    name
    author
    targetFile
    promptsAdded = [ModPrompt]
    constructor(name, author, targetFile) {
        this.name = name
        this.author = author
        this.targetFile = targetFile
    }

    /**
     * 
     * @param {string} file The file to load the mod from
     * @returns {Mod} A mod if the mod exists and is valid, null otherwise
     */
    static fromFile(file) {
        // We expect the file to be a JSON and to contain all the keys of the Mod class
        var mod = JSON.parse(readFileSync(file, (err) => { if (err) console.log(chalk.red(`Error reading file ${file}: ${err}`)) }))
        
        // For debugging, print the mod
        //console.log(mod)

        // Make sure that is a mod that adds all of the required keys
        if (mod.name && mod.author && mod.targetFile) {
            // Make sure that the promptsAdded are all valid ModPrompts
            mod.promptsAdded = mod.promptsAdded.filter(prompt => ModPrompt.isValid(prompt))
            return mod
        }
        // If not, return null
        // Also print a warning
        console.log(chalk.yellow(`Warning: ${file} is not a valid mod`))
        return null
    }
}

class ModPrompt {
    prompt
    decoys = []
    static isValid(object) {
        return object?.prompt && object?.decoys
    }
    /**
     * 
     * @param {Prompt} _prompt 
     */
    static fromPrompt(_prompt) {
        var prompt = new Prompt()
        prompt.prompt = _prompt.prompt.text
        prompt.decoys = _prompt.decoys.map(decoy => decoy.text)
        return prompt
    }
}

class Prompt {
    decoys = []
    prefix = {}
    prompt = {}
    id

    /**
     * 
     * @param {ModPrompt} modPrompt 
     */
    static fromModPrompt(modPrompt) {
        var prompt = new Prompt()
        prompt.id = nextID()
        prompt.prefix.text = ""
        prompt.prompt.text = modPrompt.prompt
        for (const decoy of modPrompt.decoys) {
            prompt.decoys.push({text: decoy})
        }

        return prompt
    }
}

class ContentFile {
    episodeid
    content = []
}

// let folder = await getSTIFolder()
// console.log(folder)

program
    .command('backup')
    .description("Backup the current content of your content folder")
    .action(backup)

program
    .command('install')
    .description("Install the mods into your content folder")
    .action(install)

program
    .command('force-install')
    .description("Install the mods into your content folder without making a backup")
    .action(writeMods)

program
    .command('backup-as-mods')
    .description("Backup the current content of your content folder as mods")
    .action(backupContentAsMods)

program
    .command('check')
    .description("Check if all your mods are valid, does not install anything")
    .action(() => {getMods().then((mods) => {console.log("Mods: " + mods.length)})})

program.parse(process.argv)