import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { room_name, admin_user_id, purse_budget_lakhs, max_squad_size, bid_timer_seconds } =
      body;

    if (!room_name || !admin_user_id) {
      return NextResponse.json(
        { error: 'room_name and admin_user_id are required' },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc('create_room', {
      p_room_name: room_name,
      p_admin_user_id: admin_user_id,
      p_purse_budget_lakhs: purse_budget_lakhs ?? 12000,
      p_max_squad_size: max_squad_size ?? 18,
      p_bid_timer_seconds: bid_timer_seconds ?? 30,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
