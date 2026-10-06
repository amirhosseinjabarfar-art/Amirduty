/* =========================================================
   AMIR DUTY - ACCOUNT CREDIT
   Supabase + Account Credit
   ========================================================= */

(() => {
    "use strict";

    /* ================================
       SUPABASE
    ================================= */

    const SUPABASE_URL =
        "https://lwdlmymtmzclrenuhxaw.supabase.co";

    const SUPABASE_KEY =
        "sb_publishable_eX-2O3OlzkEK4ZzHA-RGWQ_Ejxl3BDa";

    if (!window.supabase) {
        console.error("Supabase library is not loaded.");
        return;
    }

    const db = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );

    window.AmirDutyDB = db;


    /* ================================
       CONFIG
    ================================= */

    const CONFIG = {

        walletTable: "wallet",

        userIdFields: [
            "user_id",
            "id"
        ],

        balanceFields: [
            "balance",
            "credit"
        ]

    };


    /* ================================
       HELPERS
    ================================= */

    function number(value) {

        const n = Number(value);

        return Number.isFinite(n) ? n : 0;
    }


    function toman(value) {

        return new Intl.NumberFormat("fa-IR")
            .format(number(value)) + " تومان";

    }


    function getStoredUserId() {

        const possibleKeys = [

            "amir_duty_user_id",
            "user_id",
            "userId",
            "currentUserId",
            "loggedInUserId"

        ];

        for (const key of possibleKeys) {

            const value =
                localStorage.getItem(key);

            if (value) return value;

        }

        return null;
    }


    async function getAuthUser() {

        try {

            const {
                data,
                error
            } = await db.auth.getUser();

            if (error) return null;

            return data?.user || null;

        } catch {

            return null;

        }

    }


    async function getCurrentUserId() {

        const authUser =
            await getAuthUser();

        if (authUser?.id) {

            localStorage.setItem(
                "amir_duty_user_id",
                authUser.id
            );

            return authUser.id;

        }

        return getStoredUserId();

    }


    /* ================================
       GET CREDIT
    ================================= */

    async function getCredit(userId = null) {

        const uid =
            userId || await getCurrentUserId();

        if (!uid) {

            return {
                success: false,
                balance: 0,
                error: "USER_NOT_FOUND"
            };

        }

        try {

            const {
                data,
                error
            } = await db
                .from(CONFIG.walletTable)
                .select("*")
                .eq("user_id", uid)
                .maybeSingle();

            if (error) {

                console.error(
                    "AMIR DUTY CREDIT ERROR:",
                    error
                );

                return {
                    success: false,
                    balance: 0,
                    error
                };

            }

            if (!data) {

                return {
                    success: true,
                    balance: 0,
                    userId: uid
                };

            }

            let balance = 0;

            for (
                const field of CONFIG.balanceFields
            ) {

                if (
                    data[field] !== undefined &&
                    data[field] !== null
                ) {

                    balance =
                        number(data[field]);

                    break;

                }

            }

            return {

                success: true,

                balance,

                userId: uid,

                data

            };

        } catch (error) {

            console.error(error);

            return {

                success: false,

                balance: 0,

                error

            };

        }

    }


    /* ================================
       FIND CREDIT ELEMENTS
    ================================= */

    function getCreditElements() {

        const selectors = [

            "#accountBalance",

            "#walletBalance",

            "#userBalance",

            "#creditBalance",

            "#balance",

            "#wallet-credit",

            "#account-credit",

            "[data-account-credit]",

            "[data-wallet-balance]",

            "[data-credit]"

        ];

        const elements = [];

        selectors.forEach(selector => {

            document
                .querySelectorAll(selector)
                .forEach(element => {

                    if (!elements.includes(element)) {

                        elements.push(element);

                    }

                });

        });

        return elements;

    }


    /* ================================
       UPDATE CREDIT ON PAGE
    ================================= */

    async function updateCreditDisplay() {

        const result =
            await getCredit();

        if (!result.success) {

            return result;

        }

        const text =
            toman(result.balance);

        getCreditElements()
            .forEach(element => {

                element.textContent = text;

                element.setAttribute(
                    "data-credit-value",
                    String(result.balance)
                );

            });


        /* Custom event */

        window.dispatchEvent(
            new CustomEvent(
                "amirDutyCreditUpdated",
                {
                    detail: {

                        balance:
                            result.balance,

                        formatted:
                            text,

                        userId:
                            result.userId

                    }

                }
            )
        );


        return result;

    }


    /* ================================
       AUTO REFRESH
    ================================= */

    let refreshTimer = null;

    function startCreditRefresh() {

        if (refreshTimer) {

            clearInterval(
                refreshTimer
            );

        }

        refreshTimer =
            setInterval(
                () => {

                    updateCreditDisplay();

                },
                30000
            );

    }


    /* ================================
       BROWN THEME
    ================================= */

    function applyBrownTheme() {

        if (
            document.getElementById(
                "amir-duty-brown-theme"
            )
        ) {

            return;

        }

        const style =
            document.createElement("style");

        style.id =
            "amir-duty-brown-theme";

        style.textContent = `

            :root {

                --amir-brown:
                    #6f4328;

                --amir-brown-dark:
                    #4b2b1b;

                --amir-brown-light:
                    #a8754f;

                --amir-cream:
                    #fffaf4;

                --amir-white:
                    #ffffff;

            }


            /* Main green replacements */

            [style*="green"],
            [style*="rgb(0, 128, 0)"] {

                color:
                    var(--amir-brown) !important;

            }


            /* Common green backgrounds */

            .green,
            .success,
            .success-btn {

                background:
                    var(--amir-brown) !important;

            }


            /* Buttons */

            button {

                --green:
                    var(--amir-brown);

            }


            /* Common CSS variables */

            body {

                --primary:
                    var(--amir-brown);

                --primary-color:
                    var(--amir-brown);

                --accent:
                    var(--amir-brown);

            }


            /* Credit appearance */

            [data-account-credit],
            [data-wallet-balance],
            #accountBalance,
            #walletBalance,
            #userBalance,
            #creditBalance {

                direction: rtl;

                font-weight: 800;

            }

        `;

        document.head.appendChild(style);

    }


    /* ================================
       DUTY BOT TEXT WHITE
    ================================= */

    function makeDutyBotWhite() {

        const selectors = [

            "#dutyBot",

            "#duty-bot",

            ".duty-bot",

            ".dutyBot",

            "[data-duty-bot]",

            "[data-bot-widget]"

        ];

        selectors.forEach(selector => {

            document
                .querySelectorAll(selector)
                .forEach(element => {

                    element.style.color =
                        "#ffffff";

                    element.style.webkitTextFillColor =
                        "#ffffff";

                });

        });


        /* Text search */

        document
            .querySelectorAll("body *")
            .forEach(element => {

                const text =
                    (element.textContent || "")
                        .trim();

                if (
                    text === "دیوتی بات"
                ) {

                    element.style.color =
                        "#ffffff";

                    element.style.webkitTextFillColor =
                        "#ffffff";

                }

            });

    }


    /* ================================
       PUBLIC API
    ================================= */

    window.AmirDutyCredit = {

        get: getCredit,

        refresh:
            updateCreditDisplay,

        format:
            toman,

        current: async function () {

            const result =
                await getCredit();

            return result.balance;

        }

    };


    /* ================================
       INIT
    ================================= */

    async function init() {

        applyBrownTheme();

        makeDutyBotWhite();

        await updateCreditDisplay();

        startCreditRefresh();

    }


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            init
        );

    } else {

        init();

    }


    /* ================================
       AUTH LISTENER
    ================================= */

    db.auth.onAuthStateChange(
        () => {

            setTimeout(
                updateCreditDisplay,
                300
            );

        }
    );


})();
