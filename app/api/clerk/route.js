import { Webhook } from "svix";
import connectDB from "@/config/db";
import User from "@/models/User";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    // Initialize Svix webhook
    const wh = new Webhook(process.env.SIGNING_SECRET);

    // Get the headers (no need to await headers() - it's synchronous)
    const headerPayload = headers();

    const svixHeaders = {
      'svix-id': headerPayload.get('svix-id'),
      'svix-timestamp': headerPayload.get('svix-timestamp'),
      'svix-signature': headerPayload.get('svix-signature'),
    };

    // Get the payload and verify it
    const payload = await req.json();
    const body = JSON.stringify(payload);

    const { data, type } = wh.verify(body, svixHeaders);

    // Prepare the User data to be saved in the database
    const userData = {
      _id: data.id,
      email: data.email_addresses?.[0]?.email_address || "", // Access the correct field
      name: `${data.first_name} ${data.last_name}`,
      image: data.image_url,
    };

    // Connect to MongoDB
    await connectDB();

    // Handle different event types
    switch (type) {
      case 'user.created':
        await User.create(userData);
        break;

      case 'user.updated':
        await User.findByIdAndUpdate(data.id, userData);
        break;

      case 'user.deleted':
        await User.findByIdAndDelete(data.id);
        break;

      default:
        console.log(`Unhandled event type: ${type}`);
        break;
    }

    return NextResponse.json({ message: 'Event received' }, { status: 200 });

  } catch (error) {
    console.error('Error handling webhook:', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
