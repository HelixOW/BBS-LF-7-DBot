import axios from 'axios';
import { Client, Events, IntentsBitField, Collection, EmbedBuilder, Message, Channel } from 'discord.js';
import dotenv from 'dotenv';
const client = new Client({
	intents: [IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildMessages, IntentsBitField.Flags.MessageContent],
});

type OAuthReponse = {
	access_token: string;
	expires_in: number;
	valid_until: number;
	token_type: string;
};

// Type for the stream data
type StreamData = {
	game_id: string;
	game_name: string;
	title: string;
	viewer_count: number;
	language: string;
	tags: string[];
	is_mature: boolean;
	profilePicture: string;
	gamePicture: string;
};

// Random gifs of Idian people
const gifs: string[] = [
	'https://tenor.com/8HGD.gif',
	'https://tenor.com/bbzBd.gif',
	'https://tenor.com/bTlVO.gif',
	'https://tenor.com/bDjW5.gif',
	'https://tenor.com/Qblv.gif',
	'https://tenor.com/wRdI.gif',
	'https://tenor.com/bF2VS.gif',
];
const streamer: string = 'maciejay';
const streams: string[] = [];
const streamData: Collection<String, StreamData> = new Collection();

let tokenReponse: OAuthReponse | null = null;

// Load .env file
dotenv.config();

// Code startup when bot is ready
client.on('ready', async () => {
	// Starting the twitch watcher
	await startTwitchWatcher();

	console.log(`Logged in as ${client.user?.username}!`);
});

// Logic for handling messages
client.on(Events.MessageCreate, async (message) => {
	// If the author is a bot ignore the message
	if (message.author.bot) return;

	currencyWatcher(message);
	heartWatcher(message);
	gifReplier(message);
});

// Check if message contains any xx.xx€ and convert to DM
async function currencyWatcher(message: Message) {
	if (!message.content.match('([0-9]*.([0-9]*)?)(€)')) return;
	const price = message.content.match('([0-9]*.([0-9]*))(€)')?.[0].replace('€', '');
	await message.reply({
		content: `${price}€? Das sind ${(Number(price) * 2).toFixed(2)}DM!`,
	});
}

// Check if message is from someone and react with heart
async function heartWatcher(message: Message) {
	if (message.author.id !== '355793527516692480') return;
	try {
		await message.react('🫶');
	} catch (e) {
		console.error(e);
	}
}

// Check if message is from me and reply with random gif
async function gifReplier(message: Message) {
	if (message.author.id !== '204150777608929280') return;
	await message.reply({
		content: gifs.at(Math.floor(Math.random() * gifs.length)),
	});
}

// Get the access token for the twitch api and cache it
async function getAccessToken() {
	if (tokenReponse && tokenReponse.valid_until > Date.now()) return tokenReponse;
	try {
		const tokenDataResponse = await axios.post(
			'https://id.twitch.tv/oauth2/token',
			{
				client_id: process.env.TWITCH_CLIENT_ID,
				client_secret: process.env.TWITCH_APP_SECRET,
				grant_type: 'client_credentials',
			},
			{
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
			}
		);
		tokenReponse = tokenDataResponse.data;

		if (!tokenReponse) return null;
		tokenReponse.valid_until = Date.now() + tokenReponse.expires_in * 1000;

		return tokenReponse;
	} catch (e) {
		console.error(e);
		return null;
	}
}

async function twitchRequest(url: string, method: 'get' | 'post', params?: any, headers?: any, data?: any) {
	try {
		const accessToken = (await getAccessToken())?.access_token;

		const response = await axios({
			headers: {
				Authorization: `Bearer ${accessToken}`,
				'Client-Id': process.env.TWITCH_CLIENT_ID,
				...headers,
			},
			method,
			url,
			params,
			data,
		});

		return response.data;
	} catch (e) {
		console.error(e);
		return null;
	}
}

// Get the user info for a streamer
async function getUserInfo(streamer: string) {
	try {
		const userInfoResponse = await twitchRequest('https://api.twitch.tv/helix/users', 'get', {
			login: streamer,
		});

		return userInfoResponse.data[0];
	} catch (e) {
		console.error(e);
		return null;
	}
}

// Get the game info for a game
async function getGameInfo(game: string) {
	try {
		const gameInfoResponse = await twitchRequest('https://api.twitch.tv/helix/games', 'get', {
			id: game,
		});

		return gameInfoResponse.data[0];
	} catch (e) {
		console.error(e);
		return null;
	}
}

// Get the stream info for a streamer
async function getStreamInfo(streamer: string) {
	try {
		const streamInfoResponse = await twitchRequest('https://api.twitch.tv/helix/streams', 'get', {
			user_login: streamer,
		});

		return streamInfoResponse.data;
	} catch (e) {
		console.error(e);
		return null;
	}
}

async function startTwitchWatcher() {
	// Check for new streams every minute
	setInterval(async () => {
		const newStreams: string[] = [];
		const streamInfo = await getStreamInfo(streamer);

		if (streamInfo.length >= 1 && streams.indexOf(streamer) < 0) {
			const userData = await getUserInfo(streamer);
			const gameData = await getGameInfo(streamInfo[0].game_id);

			if (userData) streamInfo[0].profilePicture = userData.profile_image_url;
			if (gameData)
				streamInfo[0].gamePicture = (gameData.box_art_url as string)
					.replace('{width}', '500')
					.replace('{height}', '800');

			streams.push(streamer);
			newStreams.push(streamer);
			streamData.set(streamer, streamInfo[0]);
		} else if (streamInfo.length === 0 && streams.indexOf(streamer) >= 0) {
			streams.splice(streams.indexOf(streamer));
			streamData.delete(streamer);
		}

		newStreams.forEach(async (streamer) => {
			const channel: any = client.channels.cache.get('1105066399677829210');
			if (!channel) return;

			const streamInfo = streamData.get(streamer);
			if (!streamInfo) return;

			await channel.send({
				embeds: [
					new EmbedBuilder()
						.setTitle(`${streamer}`)
						.setFooter({
							text:
								`Playing ${streamInfo.game_name}` +
								' | ' +
								(streamInfo.is_mature ? '18+' : '') +
								' | ' +
								(streamInfo.tags ? streamInfo.tags.join(', ') : ''),
						})
						.setColor('Random')
						.setURL(`https://twitch.tv/${streamer}`)
						.setImage(streamInfo.profilePicture)
						.setThumbnail(streamInfo.gamePicture)
						.setAuthor({ name: 'Now Live:' }),
				],
			});
		});
	}, 60000);
}

client.login(process.env['BOT_TOKEN']);
