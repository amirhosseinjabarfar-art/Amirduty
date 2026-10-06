/* =========================================================
   AMIR DUTY - CREDIT / ROOM CODE SYSTEM
   دیوتی = اعتبار داخلی سایت
   ========================================================= */

const SUPABASE_URL = "https://lwdlmymtmzclrenuhxaw.supabase.co";
const SUPABASE_KEY = "sb_publishable_eX-2O3OlzkEK4ZzHA-RGWQ_Ejxl3BDa";

let supabaseClient = null;
let currentUser = null;

const seenRoomAlerts = new Set();

/* =========================================================
   INIT
   ========================================================= */

async function initAmirDutyCredit() {
    if (!window.supabase) {
        console.error("Supabase library پیدا نشد.");
        return;
    }

    supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );

    const {
        data: { user },
        error
    } = await supabaseClient.auth.getUser();

    if (error || !user) {
        console.log("کاربر وارد نشده است.");
        return;
    }

    currentUser = user;

    await createWalletIfNeeded();
    await loadWallet();
    await loadUserRegistrations();
    await checkRoomCodes();

    startRoomCodeRealtime();
    startRoomCodePolling();
}


/* =========================================================
   WALLET
   ========================================================= */

async function createWalletIfNeeded() {
    if (!currentUser) return;

    const { data } = await supabaseClient
        .from("wallet")
        .select("id")
        .eq("user_id", currentUser.id)
        .maybeSingle();

    if (!data) {
        await supabaseClient
            .from("wallet")
            .insert({
                user_id: currentUser.id,
                balance: 0
            });
    }
}


async function loadWallet() {
    if (!currentUser) return;

    const { data, error } = await supabaseClient
        .from("wallet")
        .select("balance")
        .eq("user_id", currentUser.id)
        .maybeSingle();

    if (error) {
        console.error("خطا در دریافت دیوتی:", error);
        return;
    }

    const balance = Number(data?.balance || 0);

    updateWalletElements(balance);
}


function updateWalletElements(balance) {

    const elements = document.querySelectorAll(
        "[data-wallet], #walletBalance, .wallet-balance"
    );

    elements.forEach(el => {
        el.textContent = `${balance.toLocaleString("fa-IR")} دیوتی`;
    });

    window.AmirDutyWallet = {
        balance
    };
}


/* =========================================================
   REGISTRATIONS
   ========================================================= */

async function loadUserRegistrations() {

    if (!currentUser) return [];

    const { data, error } = await supabaseClient
        .from("registrations")
        .select(`
            id,
            room_id,
            player_name,
            registration_date,
            created_at,
            rooms (
                id,
                name,
                status,
                finished
            )
        `)
        .eq("user_id", currentUser.id);

    if (error) {
        console.error("خطا در دریافت ثبت‌نام‌ها:", error);
        return [];
    }

    window.AmirDutyRegistrations = data || [];

    return data || [];
}


/* =========================================================
   CHECK ROOM CODES
   ========================================================= */

async function checkRoomCodes() {

    if (!currentUser) return;

    const registrations = await loadUserRegistrations();

    if (!registrations.length) {
        return;
    }

    const roomIds = [
        ...new Set(
            registrations
                .map(item => Number(item.room_id))
                .filter(Boolean)
        )
    ];

    if (!roomIds.length) return;

    /*
       نکته مهم:
       این درخواست فقط در صورتی کد را برمی‌گرداند
       که RLS دیتابیس اجازه بدهد.
    */

    const { data, error } = await supabaseClient
        .from("room_codes")
        .select(`
            id,
            room_id,
            code,
            started,
            started_at
        `)
        .in("room_id", roomIds)
        .eq("started", true);

    if (error) {
        console.error("خطا در بررسی کد اتاق:", error);
        return;
    }

    if (!data || !data.length) return;

    for (const roomCode of data) {

        const registration = registrations.find(
            r => Number(r.room_id) === Number(roomCode.room_id)
        );

        if (!registration) continue;

        /*
           جلوگیری از نمایش دوباره یک نوتیفیکیشن
           در همان باز بودن صفحه
        */

        const alertKey = String(roomCode.room_id);

        if (seenRoomAlerts.has(alertKey)) {
            continue;
        }

        seenRoomAlerts.add(alertKey);

        const room = Array.isArray(registration.rooms)
            ? registration.rooms[0]
            : registration.rooms;

        showRoomCodeNotification({
            roomId: roomCode.room_id,
            roomName: room?.name || "اتاق مسابقه",
            code: roomCode.code,
            startedAt: roomCode.started_at
        });
    }
}


/* =========================================================
   ROOM CODE NOTIFICATION
   ========================================================= */

function showRoomCodeNotification({
    roomId,
    roomName,
    code,
    startedAt
}) {

    removeExistingRoomNotification();

    /* لرزش موبایل */

    try {
        if (navigator.vibrate) {
            navigator.vibrate([
                250,
                120,
                250,
                120,
                500
            ]);
        }
    } catch (e) {}

    const overlay = document.createElement("div");

    overlay.id = "amirDutyRoomNotification";

    overlay.innerHTML = `
        <div class="ad-room-alert">

            <div class="ad-room-glow"></div>

            <div class="ad-room-title">
                اتاق مسابقه شروع شد
            </div>

            <div class="ad-room-subtitle">
                ${escapeHTML(roomName)}
            </div>

            <div class="ad-room-label">
                کد ورود اتاق
            </div>

            <div class="ad-room-code">
                ${escapeHTML(String(code))}
            </div>

            <div class="ad-room-buttons">

                <button
                    type="button"
                    id="adCopyRoomCode">
                    کپی کد
                </button>

                <button
                    type="button"
                    id="adCloseRoomNotification">
                    بستن
                </button>

            </div>

        </div>
    `;

    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
        overlay.classList.add("show");
    });

    const copyButton =
        document.getElementById("adCopyRoomCode");

    const closeButton =
        document.getElementById("adCloseRoomNotification");

    copyButton?.addEventListener("click", async () => {

        try {

            await navigator.clipboard.writeText(String(code));

            copyButton.textContent = "کپی شد ✓";

            if (navigator.vibrate) {
                navigator.vibrate(100);
            }

            setTimeout(() => {
                copyButton.textContent = "کپی کد";
            }, 1800);

        } catch (error) {

            /* روش جایگزین برای بعضی مرورگرها */

            const textarea = document.createElement("textarea");

            textarea.value = String(code);
            textarea.style.position = "fixed";
            textarea.style.opacity = "0";

            document.body.appendChild(textarea);

            textarea.select();

            try {
                document.execCommand("copy");
                copyButton.textContent = "کپی شد ✓";
            } catch (e) {
                copyButton.textContent = "کپی نشد";
            }

            textarea.remove();
        }
    });


    closeButton?.addEventListener("click", () => {

        overlay.classList.remove("show");

        setTimeout(() => {
            overlay.remove();
        }, 350);
    });
}


/* =========================================================
   REMOVE NOTIFICATION
   ========================================================= */

function removeExistingRoomNotification() {

    const old =
        document.getElementById("amirDutyRoomNotification");

    if (!old) return;

    old.remove();
}


/* =========================================================
   REALTIME
   ========================================================= */

function startRoomCodeRealtime() {

    if (!supabaseClient || !currentUser) return;

    supabaseClient
        .channel("amir-duty-room-codes")
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "room_codes"
            },
            async () => {

                /*
                   وقتی مدیریت کد را تغییر دهد یا
                   started را true کند، دوباره بررسی می‌کنیم.
                */

                await checkRoomCodes();
            }
        )
        .subscribe();
}


/* =========================================================
   POLLING BACKUP
   ========================================================= */

function startRoomCodePolling() {

    /*
       Realtime روش اصلی است.
       این polling پشتیبان است تا اگر realtime
       روی مرورگر یا هاست کار نکرد، کد همچنان برسد.
    */

    setInterval(async () => {

        if (!currentUser) return;

        await checkRoomCodes();

    }, 10000);
}


/* =========================================================
   ESCAPE HTML
   ========================================================= */

function escapeHTML(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


/* =========================================================
   CSS
   ========================================================= */

(function injectRoomNotificationCSS() {

    if (document.getElementById("amir-duty-room-css")) {
        return;
    }

    const style = document.createElement("style");

    style.id = "amir-duty-room-css";

    style.textContent = `

        #amirDutyRoomNotification {
            position: fixed;
            inset: 0;
            z-index: 999999999;

            display: flex;
            align-items: center;
            justify-content: center;

            padding: 20px;

            background:
                rgba(8, 12, 30, 0.72);

            backdrop-filter:
                blur(18px);

            -webkit-backdrop-filter:
                blur(18px);

            opacity: 0;

            transition:
                opacity .35s ease;
        }


        #amirDutyRoomNotification.show {
            opacity: 1;
        }


        .ad-room-alert {

            position: relative;

            width: min(430px, 94vw);

            padding: 32px 24px 24px;

            border-radius: 28px;

            text-align: center;

            overflow: hidden;

            background:
                linear-gradient(
                    145deg,
                    rgba(255,255,255,.98),
                    rgba(240,246,255,.97)
                );

            border:
                1px solid rgba(255,255,255,.8);

            box-shadow:
                0 25px 80px rgba(0,0,0,.35),
                0 0 45px rgba(60,120,255,.25);

            transform:
                translateY(35px)
                scale(.88);

            animation:
                adRoomPopup .65s cubic-bezier(.2,.9,.2,1)
                forwards;
        }


        .ad-room-glow {

            position: absolute;

            width: 180px;
            height: 180px;

            top: -90px;
            right: -60px;

            border-radius: 50%;

            background:
                radial-gradient(
                    circle,
                    rgba(70,130,255,.5),
                    transparent 70%
                );

            filter: blur(8px);

            animation:
                adRoomGlow 2s ease-in-out infinite alternate;
        }


        .ad-room-title {

            position: relative;

            font-family:
                Vazirmatn,
                Tahoma,
                sans-serif;

            font-size: 26px;

            font-weight: 900;

            color: #172554;

            margin-bottom: 10px;
        }


        .ad-room-subtitle {

            position: relative;

            font-family:
                Vazirmatn,
                Tahoma,
                sans-serif;

            font-size: 16px;

            font-weight: 700;

            color: #64748b;

            margin-bottom: 25px;
        }


        .ad-room-label {

            position: relative;

            font-family:
                Vazirmatn,
                Tahoma,
                sans-serif;

            font-size: 14px;

            color: #64748b;

            margin-bottom: 8px;
        }


        .ad-room-code {

            position: relative;

            direction: ltr;

            user-select: all;

            font-family:
                monospace;

            font-size: 34px;

            font-weight: 900;

            letter-spacing: 5px;

            color: #2563eb;

            padding: 18px 15px;

            margin-bottom: 22px;

            border-radius: 18px;

            background:
                linear-gradient(
                    135deg,
                    #eff6ff,
                    #dbeafe
                );

            border:
                2px solid rgba(37,99,235,.2);

            box-shadow:
                inset 0 0 25px rgba(37,99,235,.08),
                0 0 30px rgba(37,99,235,.12);

            animation:
                adRoomCodePulse 1.8s ease-in-out infinite;
        }


        .ad-room-buttons {

            position: relative;

            display: grid;

            grid-template-columns:
                1fr 1fr;

            gap: 10px;
        }


        .ad-room-buttons button {

            border: none;

            border-radius: 15px;

            padding: 14px 10px;

            cursor: pointer;

            font-family:
                Vazirmatn,
                Tahoma,
                sans-serif;

            font-size: 15px;

            font-weight: 800;

            transition:
                transform .2s ease,
                box-shadow .2s ease;
        }


        #adCopyRoomCode {

            color: white;

            background:
                linear-gradient(
                    135deg,
                    #2563eb,
                    #7c3aed
                );

            box-shadow:
                0 10px 25px
                rgba(37,99,235,.25);
        }


        #adCloseRoomNotification {

            color: #334155;

            background: #e2e8f0;
        }


        .ad-room-buttons button:hover {

            transform:
                translateY(-3px)
                scale(1.02);
        }


        .ad-room-buttons button:active {

            transform:
                scale(.96);
        }


        @keyframes adRoomPopup {

            0% {
                opacity: 0;
                transform:
                    translateY(60px)
                    scale(.75)
                    rotate(-2deg);
            }

            60% {
                opacity: 1;
                transform:
                    translateY(-8px)
                    scale(1.03)
                    rotate(1deg);
            }

            100% {
                opacity: 1;
                transform:
                    translateY(0)
                    scale(1)
                    rotate(0);
            }
        }


        @keyframes adRoomGlow {

            from {
                transform: scale(.8);
                opacity: .55;
            }

            to {
                transform: scale(1.35);
                opacity: 1;
            }
        }


        @keyframes adRoomCodePulse {

            0%,100% {
                transform: scale(1);
            }

            50% {
                transform: scale(1.025);
            }
        }


        @media(max-width:480px) {

            .ad-room-alert {
                padding: 28px 18px 20px;
                border-radius: 24px;
            }

            .ad-room-title {
                font-size: 22px;
            }

            .ad-room-code {
                font-size: 27px;
                letter-spacing: 3px;
            }

            .ad-room-buttons {
                grid-template-columns: 1fr;
            }
        }

    `;

    document.head.appendChild(style);

})();


/* =========================================================
   PUBLIC API
   ========================================================= */

window.AmirDutyCredit = {

    getUser: () => currentUser,

    getWallet: () =>
        window.AmirDutyWallet || { balance: 0 },

    getRegistrations: () =>
        window.AmirDutyRegistrations || [],

    reloadWallet: loadWallet,

    reloadRegistrations: loadUserRegistrations,

    checkRoomCodes,

    refresh: async () => {
        await loadWallet();
        await loadUserRegistrations();
        await checkRoomCodes();
    }

};


/* =========================================================
   START
   ========================================================= */

if (document.readyState === "loading") {

    document.addEventListener(
        "DOMContentLoaded",
        initAmirDutyCredit
    );

} else {

    initAmirDutyCredit();

}
