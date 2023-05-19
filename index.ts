import axios from 'axios';
import { Client, Events, IntentsBitField, Collection, EmbedBuilder } from 'discord.js';
import dotenv from 'dotenv';
const client = new Client({
	intents: [IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildMessages, IntentsBitField.Flags.MessageContent],
});

const gifs: string[] = [
	'https://tenor.com/8HGD.gif',
	'https://tenor.com/bbzBd.gif',
	'https://tenor.com/bTlVO.gif',
	'https://tenor.com/bDjW5.gif',
	'https://tenor.com/Qblv.gif',
	'https://tenor.com/wRdI.gif',
	'https://tenor.com/bF2VS.gif',
];

dotenv.config();

client.on('ready', async () => {
	await startTwitchWatcher();

	console.log(`Logged in as ${client.user?.username}!`);
});

client.on(Events.MessageCreate, async (message) => {
	if (message.author.bot) return;

	if (message.content.match('([0-9]*.([0-9]*)?)(€)')) {
		const price = message.content.match('([0-9]*.([0-9]*))(€)')?.[0].replace('€', '');

		// Round price to 2 digits
		// const roundedPrice = Math.round(price * 100) / 100;

		// Display price with 2 digits

		await message.reply({
			content: `${price}€? Das sind ${(Number(price) * 2).toFixed(2)}DM!`,
		});
	}

	if (message.author.id === '') {
		// Maurice
		try {
			await message.react('🫶');
		} catch (e) {
			console.error(e);
		}
		await message.reply({
			content: 'EZ fix',
		});
	}

	if (message.author.id === '') {
		// Gregor
		await message.reply({
			content: gifs.at(Math.floor(Math.random() * gifs.length)),
		});
	}
});

export type StreamData = {
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

async function getAccessToken() {
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
		return tokenDataResponse.data.access_token;
	} catch (e) {
		console.error(e);
		return null;
	}
}

async function getUserInfo(streamer: string) {
	try {
		const userInfoResponse = await axios.get('https://api.twitch.tv/helix/users', {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				'Client-Id': process.env.TWITCH_CLIENT_ID,
			},
			params: {
				login: streamer,
			},
		});

		return userInfoResponse.data.data[0];
	} catch (e) {
		console.error(e);
		accessToken = await getAccessToken();
		return null;
	}
}

async function getGameInfo(game: string) {
	try {
		const gameInfoResponse = await axios.get('https://api.twitch.tv/helix/games', {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				'Client-Id': process.env.TWITCH_CLIENT_ID,
			},
			params: {
				id: game,
			},
		});

		return gameInfoResponse.data.data[0];
	} catch (e) {
		console.error(e);
		accessToken = await getAccessToken();
		return null;
	}
}

async function getStreamInfo(streamer: string) {
	try {
		const streamInfoResponse = await axios.get('https://api.twitch.tv/helix/streams', {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				'Client-Id': process.env.TWITCH_CLIENT_ID,
			},
			params: {
				user_login: streamer,
			},
		});

		return streamInfoResponse.data.data;
	} catch (e) {
		console.error(e);
		accessToken = await getAccessToken();
		return null;
	}
}

let accessToken: any = null;
export const streams: string[] = [];
export const streamData: Collection<String, StreamData> = new Collection();

async function startTwitchWatcher() {
	accessToken = await getAccessToken();
	setInterval(async () => {
		const newStreams: any[] = [];

		const streamer: string = 'ml7support';
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
	}, /*60000*/ 1000);
}

client.login(process.env['BOT_TOKEN']);
