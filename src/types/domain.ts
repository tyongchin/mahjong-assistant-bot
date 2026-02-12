export type ParsedLine = { 
    username: string; 
    delta: number 
};

export type Player = {
    user_id: string;
    username: string | null;
    display_name: string | null;
};


// Settlement types
export type BalanceEntry = {
    id: string;      // user_id or virtual id
    name: string;    // @username or display
    balance: number; // + => should receive, - => should pay
};

export type Transfer = {
    from: string;   // payer name
    to: string;     // receiver name
    amount: number; // positive integer
};

export type AutoBalanceResult = {
    adjusted: BalanceEntry[];
    net_before: number;
    applied_net: number; // how much was redistributed (abs(netBefore), unless impossible)
    note: string | null;
};

// Leaderboard points types
export type PointsDelta = {
    user_id: string;
    username: string | null;
    display_name: string | null;
    delta_points: number;
    reason: string;
};