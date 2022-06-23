# AID
Very simple mod loader for Survive The Internet and nothing else

# Installation
Dependencies:
   - [Node.js](https://nodejs.org/en/)
    
   - [npm](https://www.npmjs.com/)

   - Survive The Internet (Jackbox Party Pack 4)

Simply download or clone the repository and run `npm start` in it

# Usage
Every time you run AID, it tries to determine where your game is. 

You can run the program in the SurviveTheInternet folder on your computer to help it.

You'll probably want to first backup your content folder with 
```sh
npm start backup
```

If you also would like to *not* remove all of the prompts already in the game, run 
```sh
npm start backup-as-mods
```
This will backup your current content as mods that can be loaded later

After editing the mods, adding prompts, or installing whatever, run 
```sh
npm install
```

You can then start the game as normal and enjoy your custom prompts!
