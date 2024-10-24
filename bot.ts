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

// Pick a random numbered folder from ./posts
function getRandomFolder(basePath: string): string | null {
    const folders = fs.readdirSync(basePath).filter((name) =>
        fs.statSync(path.join(basePath, name)).isDirectory()
    );
    if (folders.length === 0) return null;
    const randomFolder = folders[Math.floor(Math.random() * folders.length)];
    return path.join(basePath, randomFolder);
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
}

// Handle login and posting
async function main() {
    await agent.login({
        identifier: process.env.BLUESKY_USERNAME!,
        password: process.env.BLUESKY_PASSWORD!
    });

    const folderPath = getRandomFolder('./posts');
    if (!folderPath) {
        console.error('No folders found in ./posts');
        return;
    }

    const textPath = path.join(folderPath, 'text.txt');
    const altPath = path.join(folderPath, 'alt.txt');
    const imagePath = findImageFile(folderPath);

    if (!fs.existsSync(textPath)) {
        console.error(`Missing text.txt in folder: ${folderPath}`);
        return;
    }

    const textVal = fs.readFileSync(textPath, 'utf-8').trim();
    const altVal = fs.existsSync(altPath) ? fs.readFileSync(altPath, 'utf-8').trim() : undefined;
    const imageVal = imagePath ? fs.readFileSync(imagePath) : undefined;

    await postContent(textVal, imageVal, altVal);

    // Move the processed folder to prevPosts
    const destination = path.join('./prevPosts', path.basename(folderPath));
    fs.renameSync(folderPath, destination);

    console.log(`Posted content from folder ${path.basename(folderPath)} and moved it to ./prevPosts`);
}

// Run this on a cron job
const scheduleExpressionMinute = '* * * * *'; // Run once every minute for testing
const scheduleExpression = '0 */4 * * *'; // Run every three hours in production

const job = new CronJob(scheduleExpression, main); // Use scheduleExpressionMinute for testing

job.start();
