import { NextRequest, NextResponse } from 'next/server';
import { followTrader, unfollowTrader, isFollowing, getFollowing, getFollowers } from '../../../../../shared/services/social-trading';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const traderId = searchParams.get('traderId');
    const type = searchParams.get('type'); // 'following' or 'followers'

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const parsedUserId = parseInt(userId);

    if (traderId && type === 'check') {
      const following = await isFollowing(parsedUserId, parseInt(traderId));
      return NextResponse.json({ isFollowing: following });
    }

    if (type === 'following') {
      const following = await getFollowing(parsedUserId);
      return NextResponse.json(following);
    }

    if (type === 'followers' && traderId) {
      const followers = await getFollowers(parseInt(traderId));
      return NextResponse.json(followers);
    }

    return NextResponse.json(
      { error: 'Invalid parameters' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error in follow API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { followerId, traderId, action } = body;

    if (!followerId || !traderId) {
      return NextResponse.json(
        { error: 'Follower ID and Trader ID are required' },
        { status: 400 }
      );
    }

    let result;
    if (action === 'unfollow') {
      result = await unfollowTrader(followerId, traderId);
    } else {
      result = await followTrader(followerId, traderId);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in follow/unfollow:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
