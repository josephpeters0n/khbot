// Joseph Peterson
// KH Bot 0.0.1
// 2024-10-24

import Proto from '@atproto/api';
import * as dotenv from 'dotenv';
import { CronJob } from 'cron';
import * as process from 'process';
import fs from 'fs';
import path from 'path';

const { BskyAgent } = Proto;

dotenv.config();

// Create a Bluesky Agent
const agent = new BskyAgent({ service: 'https://bsky.social' });
console.log('Bluesky Agent initialized.');

// Pick a random numbered folder from ./posts
function getRandomFolder(basePath: string): string | null {
    const folders = fs.readdirSync(basePath).filter((name) =>
        fs.statSync(path.join(basePath, name)).isDirectory()
    );
    return folders.length > 0 
        ? path.join(basePath, folders[Math.floor(Math.random() * folders.length)]) 
        : null;
}

// Find the image file within the folder
function findImageFile(folderPath: string): string | null {
    const supportedFormats = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    const files = fs.readdirSync(folderPath);
    const imageFile = files.find((file) =>
        supportedFormats.includes(file.split('.').pop()?.toLowerCase() || '')
    );
    return imageFile ? path.join(folderPath, imageFile) : null;
}

// Post content with optional image and alt text
async function postContent(textVal: string, imageVal?: Buffer, altVal?: string) {
    const postData: any = {
        text: textVal,
        langs: ['en-US'],
        createdAt: new Date().toISOString(),
    };

    if (imageVal) {
        const { data } = await agent.uploadBlob(imageVal, { encoding: 'image/jpeg' });
        postData.embed = {
            $type: 'app.bsky.embed.images',
            images: [{ alt: altVal || 'Image', image: data.blob }],
        };
    }

    await agent.post(postData);
    console.log('Content posted successfully.');
}

// Handle login and posting
async function main() {
    try {
        await agent.login({
            identifier: process.env.BLUESKY_USERNAME!,
            password: process.env.BLUESKY_PASSWORD!,
        });

        const folderPath = getRandomFolder('./posts');
        if (!folderPath) return;

        const textPath = path.join(folderPath, 'text.txt');
        if (!fs.existsSync(textPath)) return;

        const textVal = fs.readFileSync(textPath, 'utf-8').trim();
        const altVal = fs.existsSync(path.join(folderPath, 'alt.txt'))
            ? fs.readFileSync(path.join(folderPath, 'alt.txt'), 'utf-8').trim()
            : undefined;

        const imagePath = findImageFile(folderPath);
        const imageVal = imagePath ? fs.readFileSync(imagePath) : undefined;

        await postContent(textVal, imageVal, altVal);

        fs.renameSync(folderPath, path.join('./prevPosts', path.basename(folderPath)));
    } catch (error) {
        console.error('Error during execution:', error);
    }
}

// Run this on a cron job
const scheduleExpression = '0 9,15,21 * * *';

console.log('Setting up cron job...');
const job = new CronJob(scheduleExpression, async () => {
    console.log(`Cron job triggered at ${new Date().toISOString()}`);
    await main();
});

job.start();
console.log('Cron job started.');

// Initial run to verify functionality
main().catch((error) => console.error('Initial run error:', error));
