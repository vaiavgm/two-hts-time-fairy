const Discord = require("discord.js");
const Canvas = require("canvas");
const gifEncoder = require("gif-encoder-2");


async function createRandomizedImage(canvas)
{
    const context = canvas.getContext("2d");
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

    // Loop through each pixel in the ImageData and randomize its color
    for (let i = 0; i < imageData.data.length; i += 4)
    {
        imageData.data[i] = Math.floor(Math.random() * 256);   // red component
        imageData.data[i + 1] = Math.floor(Math.random() * 256); // green component
        imageData.data[i + 2] = Math.floor(Math.random() * 256); // blue component
        imageData.data[i + 3] = 255; // alpha component
    }

    // Put the modified ImageData back onto the canvas
    context.putImageData(imageData, 0, 0);

    // Convert the canvas to an image buffer
    const buffer = canvas.toBuffer();

    return buffer;

}

const { SlashCommandBuilder } = require("@discordjs/builders");
module.exports = {

    data: new SlashCommandBuilder().setName("randomgif").setDescription("Creates a randomized animated gif"),

    async execute(interaction)
    {
        await interaction.deferReply();

        // Create a new canvas with dimensions 50x50 pixels
        const canvas = Canvas.createCanvas(100, 100);

        // Create two images with randomized colors
        // const image1 = await createRandomizedImage(canvas);
        // 
        // const image2 = await createRandomizedImage(canvas);

        // Create a new GIF with the two images alternating
        const encoder = new gifEncoder(canvas.width, canvas.height);
        // 500ms between each frame
        encoder.setDelay(200);
        // Loop indefinitely
        encoder.setRepeat(0);
        encoder.start();
        encoder.addFrame(await createRandomizedImage(canvas));
        // 500ms between each frame
        encoder.setDelay(500);
        encoder.addFrame(await createRandomizedImage(canvas));

        // 500ms between each frame
        encoder.setDelay(500);
        encoder.addFrame(await createRandomizedImage(canvas));
        encoder.finish();

        // Get the image data as a Buffer object
        const imageData = await encoder.out.getData();

        // Create a new attachment with the GIF image data
        const attachment = new Discord.MessageAttachment(imageData, "alternating-images.gif");

        // Create a new embed with the attachment
        const embed = new Discord.MessageEmbed()
            .setTitle("Alternating Images GIF")
            .setDescription("This GIF alternates between two randomized images.")
            .setImage("attachment://alternating-images.gif");

        interaction.editReply({ embeds: [embed], files: [attachment] });
    },
};
