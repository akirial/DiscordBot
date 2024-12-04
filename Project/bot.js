require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { OpenAI } = require('openai');
const fs = require('fs');
const gTTS = require('gtts');
const path = require('path');
const { joinVoiceChannel, createAudioResource, createAudioPlayer, AudioPlayerStatus } = require('@discordjs/voice');
const ffmpeg = require('fluent-ffmpeg');

// Discord and OpenAI tokens
const TOKEN = ""  // Your Discord bot token, i took mine out
const OPENAI_API_KEY = '';  // Your OpenAI API key, i took mine out


// Initialize OpenAI API client
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// Create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  try {
    // Commands
    if (message.content.startsWith('!gbHelp')) {
      const helpMessage = `
      **__Available Commands:__**
      Here are the commands you can use in this bot:
    
      \`!ran [d/o]\`:        Randomly assigns an operator to voice channel members.
          - *Use "d" for defense operators or "o" for offensive operators.*
    
      \`!speech\`:           Generates a motivational heroic speech to inspire players.
    
      \`!ask [question]\`:   Ask a question, and get advice or tips.
    
      \`!rl\`:        Randomly selects a leader from the voice channel members.
    
      \`!sm [map]\`:  Displays popular spawn peaks for the map you're playing.
    
      \`!bumbum\`:           Plays a fun audio file for everyone in the voice channel.
    
      \`!tips [map]\`:       Provides tips for improving on your current map.
    
      \`!tipOp [operator]\`: Gives tips for playing a specific operator.
    
      \`!lp\`:            Predicts when you’ll get your next loot pack.
    
      \`!st\`:             A suggestion to avoid roaming and stay with the team for better survival.
    
      \`!ns\`:            Announces whether or not anyone is on the "nSite".
    
      \`!dp\`:           Announces the current game phase (e.g., drone phase, preparation phase).
    
      \`!ga\`:               "GooooodAimGoodAimGoodAimGoodAimGoodAimGoodAimGoodAim"
    
      \`!ut\`:               "Your Throwing, You Sold, What Are You Doing Doing Doing"
    
      \`!sb\`:               "SCoreboard Chump Chump"
    
      \`!ub\`:               "Your just better, Your just better, Your just better"
    
      \`!pb\`:               "plant the bomb, plant, plaaaaaaant, plant"
    
      **Tip**: Type \`!gbHelp\` again anytime for a reminder of these commands!
      `;
    
      await message.reply(helpMessage);
    }
    
    

    // Other commands
    if (message.content.startsWith('!ran')) {
      const args = message.content.split(' '); // Split the message into parts
      const type = args[1]; // This will get the second part (either 'd' or 'o')
      const members = Array.from(message.guild.members.cache.values());
      
      // Filter out the bot from the members list
      const nonBotMembers = members.filter(member => !member.user.bot);
    
      let operatorAssignments = [];
    
      // Define a function to ask OpenAI for a random operator based on the type
      const getRandomOperatorFromOpenAI = async (type, username) => {
        let prompt = '';
    
        if (type === 'd') {
          prompt = `Give a random defensive operator from Rainbow Six Siege for ${username}.`;
        } else if (type === 'o') {
          prompt = `Give a random offensive operator from Rainbow Six Siege for ${username}.`;
        } else {
          prompt = `Give a random operator from Rainbow Six Siege for ${username}.`;
        }
    
        const response = await getOpenAIResponse(prompt);
        return response.trim(); // Trim any extra whitespace
      };
    
      // Ask OpenAI to generate a random operator for each non-bot member, based on the type
      for (const member of nonBotMembers) {
        let randomOperator;
    
        if (type === 'd' || type === 'o') {
          randomOperator = await getRandomOperatorFromOpenAI(type, member.user.username);
        } else {
          randomOperator = await getRandomOperatorFromOpenAI('', member.user.username);
        }
    
        operatorAssignments.push(`${member.user.username} -> ${randomOperator}`);
      }
    
      const assignmentText = `Operator assignments:\n${operatorAssignments.join('\n')}`;
    
      // Send the text reply to the channel
      await message.reply(assignmentText);
    
      // Then, convert the assignmentText to speech and play it in the voice channel
      await sendTextAndAudio(message, assignmentText);
    }
    

    if (message.content.startsWith('!speech')) {
      const heroicSpeech = await getOpenAIResponse(
        'Generate a motivational and heroic speech that inspires players to get out of copper in ranked seige.'
      );
      await message.reply(heroicSpeech);
      await sendTextAndAudio(message, heroicSpeech);
    }

    if (message.content.startsWith('!ask')) {
      const question = message.content.slice(5).trim();  // Captures text after !ask
      if (!question) return message.reply("Please provide Input after the command");
      const response = await getOpenAIResponse(` ${question}`);
      await sendTextAndAudio(message, response);
    }

    if (message.content.startsWith('!rl')) {
      const members = Array.from(message.guild.members.cache.values());
      const randomMember = members[Math.floor(Math.random() * members.length)];
      const response = `${randomMember.user.username} is selected as the leader!`
      
      await sendTextAndAudio(message, response);

      await message.reply(response);
    }

    if (message.content.startsWith('!sm')) {
      const map = message.content.slice(4).trim();  // Captures text after !spawnPeek
      if (!map) return message.reply("Please provide a map name after the command.");
      const response = await getOpenAIResponse(`Find the popular spawn peeks on rainbow six seige for the map ${map}.`);
      await message.reply(response);
      await sendTextAndAudio(message, response);
    }

    if (message.content.startsWith('!bumbum')) {
      const audioFilePath = path.join(__dirname, 'bumtest.mp3');
      await playInVoiceChannel(message, audioFilePath);
    }

    if (message.content.startsWith('!tips')) {
      const map = message.content.slice(6).trim();  // Captures text after !tips
      if (!map) return message.reply("Please provide a map name after the command.");
    
      // Ask OpenAI for tips for the specified map
      const mapTips = await getOpenAIResponse(`Give me some tips for improving on the map ${map} in Rainbow Six Siege`);
    
      const response = `Here are some tips for improving on the map ${map}:\n${mapTips}`;
      await message.reply(response);
      await sendTextAndAudio(message, response);  // Send the text and play audio
    }

    if (message.content.startsWith('!tipOp')) {
      const operator = message.content.slice(7).trim();  // Captures text after !tipOp
      if (!operator) return message.reply("Please provide an operator name after the command.");
    
      // Ask OpenAI for tips for the specified operator
      const operatorTips = await getOpenAIResponse(`Give me some tips for playing the operator ${operator} in Rainbow Six Siege`);
    
      const response = `Here are some tips for playing the operator ${operator}:\n${operatorTips}`;
      await message.reply(response);
      await sendTextAndAudio(message, response);  // Send the text and play audio
    }

    if (message.content.startsWith('!lp')) {
const ranNumber =  Math.floor(Math.random() * (11 - 1 + 1)) + 1;

      const lootPrediction = `You will get your next loot pack in ${ranNumber} games.`;
      await sendTextAndAudio(message, lootPrediction);
    }

    if (message.content.startsWith('!st')) {
      const stayMessage = 'Please don\'t roam, you\'re just going to get killed!';
      await sendTextAndAudio(message, stayMessage);
    }

    if (message.content.startsWith('!ns')) {
      const nSiteMessage = 'There is no one on Site.';
      await sendTextAndAudio(message, nSiteMessage);
    }


    if (message.content.startsWith('!ga')) {
      const nSiteMessage = 'GooooodAimGoodAimGoodAimGoodAimGoodAimGoodAimGoodAim';
      await sendTextAndAudio(message, nSiteMessage);
    }


    if (message.content.startsWith('!ut')) {
      const nSiteMessage = 'Your Throwing, You Sold, What Are You Doing Doing Doing';
      await sendTextAndAudio(message, nSiteMessage);
    }


    if (message.content.startsWith('!sb')) {
      const nSiteMessage = 'SCoreboard Chump Chump';
      await sendTextAndAudio(message, nSiteMessage);
    }


    if (message.content.startsWith('!ub')) {
      const nSiteMessage = 'Your just better, Your just better, Your just better';
      await sendTextAndAudio(message, nSiteMessage);
    }


    if (message.content.startsWith('!pb')) {
      const nSiteMessage = 'plant the bomb, plant, plaaaaaaant, plant';
      await sendTextAndAudio(message, nSiteMessage);
    }



    if (message.content.startsWith('!dp')) {
      const phaseMessage = 'This is the drone phase, not the phone phase.';
      await sendTextAndAudio(message, phaseMessage);
    }
  } catch (error) {
    console.error('Error in messageCreate event:', error);
    message.reply('An unexpected error occurred. Please try again later.');
    process.exit(1);
  }
});

// Error handler for uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);  // 1 indicates an error occurred
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
  process.exit(1);  // 1 indicates an error occurred
});

// Function to interact with OpenAI and get a concise response
async function getOpenAIResponse(prompt) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150,  // Adjust if needed
    });

    const result = response.choices[0].message.content;
    return result.length > 800 ? result.slice(0, 800) + '...' : result; // Truncate if necessary
  } catch (error) {
    console.error('Error with OpenAI API:', error);
    throw new Error('Failed to fetch a response from OpenAI.');
  }
}

// Function to convert text to speech using gTTS
async function convertTextToSpeech(text, filePath) {
  return new Promise((resolve, reject) => {
    const gtts = new gTTS(text, 'en');
    gtts.save(filePath, (err) => {
      if (err) {
        console.error('Error saving audio file:', err);
        return reject(err);
      }
      console.log('Audio file saved at:', filePath);
      resolve();
    });
  });
}

// Function to play audio in the voice channel
async function playInVoiceChannel(message, inputFilePath) {
  try {
    const userVoiceChannel = message.member.voice.channel;
    if (!userVoiceChannel) {
      return message.reply('You need to join a voice channel to use this command!');
    }

    console.log(`Playing audio from: ${inputFilePath}`);

    // Join the voice channel
    const connection = joinVoiceChannel({
      channelId: userVoiceChannel.id,
      guildId: message.guild.id,
      adapterCreator: message.guild.voiceAdapterCreator,
    });

    const player = createAudioPlayer();
    const resource = createAudioResource(inputFilePath);  // Use inputFilePath directly without conversion

    connection.subscribe(player);
    player.play(resource);

    player.on(AudioPlayerStatus.Idle, () => {
      console.log('Finished playing the audio.');
      connection.destroy();
    });

    player.on('error', (error) => {
      console.error('Audio player error:', error);
      connection.destroy();
      message.reply('An error occurred while playing the audio.');
    });

  } catch (error) {
    console.error('Error in playInVoiceChannel:', error);
    message.reply('Could not connect to the voice channel or play the audio.');
  }
}

// Function to send text and audio replies
async function sendTextAndAudio(message, text) {
  try {
    const audioFilePath = path.join(__dirname, 'response.mp3');
    if (fs.existsSync(audioFilePath)) fs.unlinkSync(audioFilePath);

    await convertTextToSpeech(text, audioFilePath);
    await playInVoiceChannel(message, audioFilePath);

  } catch (error) {
    console.error('Error in sendTextAndAudio:', error);
    await message.reply('Failed to generate or play audio.');
    process.exit(1);  // Trigger restart on error
  }
}

client.login(TOKEN);
