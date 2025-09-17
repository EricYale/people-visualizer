function timeStrToMinutes(t) {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
}

function stopIsToday(stop, day) {
    const dayBit = 1 << ((day + 1) % 7);
    return (stop.d & dayBit) !== 0;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
