alert("supabase.js loaded");

const supabaseUrl = "https://vcdmwgpcbyjsklajtort.supabase.co";
const supabaseKey = "sb_publishable_rzbaKieEka6hnJvnr55jlA_IpSzjLOZ";

const supabaseClient = window.supabase.createClient(
    supabaseUrl,
    supabaseKey
);

console.log("Connected to Supabase!");
console.log(supabaseClient);