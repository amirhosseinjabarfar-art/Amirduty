/* =========================================================
   AMIR DUTY - CREDIT / ROOMS SYSTEM
   Supabase
   ========================================================= */

(() => {
  "use strict";

  /* =========================================================
     SUPABASE
     ========================================================= */

  const SUPABASE_URL =
    "https://lwdlmymtmzclrenuhxaw.supabase.co";

  const SUPABASE_KEY =
    "sb_publishable_eX-2O3OlzkEK4ZzHA-RGWQ_Ejxl3BDa";

  if (!window.supabase) {
    console.error("Supabase library not loaded.");
    return;
  }

  const supabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );

  window.AmirDutyDB = supabase;


  /* =========================================================
     TABLES
     ========================================================= */

  const TABLES = {
    users: "users",
    wallet: "wallet",
    rooms: "rooms",
    registrations: "registrations",
    roomCodes: "room_codes"
  };


  /* =========================================================
     HELPERS
     ========================================================= */

  const $ = (selector) =>
    document.querySelector(selector);

  const $$ = (selector) =>
    [...document.querySelectorAll(selector)];


  function escapeHTML(value) {

    const div =
      document.createElement("div");

    div.textContent =
      value ?? "";

    return div.innerHTML;
  }


  function formatNumber(value) {

    return Number(value || 0)
      .toLocaleString("fa-IR");

  }


  /* =========================================================
     CURRENT USER
     ========================================================= */

  async function getCurrentUser() {

    try {

      const {
        data,
        error
      } = await supabase.auth.getUser();

      if (!error && data?.user) {
        return data.user;
      }

    } catch (error) {

      console.warn(
        "Auth error:",
        error
      );

    }

    return null;
  }


  async function getCurrentUserId() {

    const user =
      await getCurrentUser();

    return user?.id || null;

  }


  /* =========================================================
     CREDIT
     ========================================================= */

  async function loadCredit() {

    const userId =
      await getCurrentUserId();

    if (!userId) return null;


    try {

      const {
        data,
        error
      } = await supabase
        .from(TABLES.wallet)
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();


      if (error) {

        console.error(
          "Wallet error:",
          error
        );

        return null;
      }


      if (!data) {

        updateCreditUI(0);

        return 0;
      }


      const credit =
        data.balance ??
        data.credit ??
        data.duty ??
        data.amount ??
        0;


      updateCreditUI(credit);

      return credit;

    } catch (error) {

      console.error(
        "Credit error:",
        error
      );

      return null;

    }

  }


  function updateCreditUI(credit) {

    const selectors = [

      "#accountBalance",

      "#walletBalance",

      "#userBalance",

      "#creditBalance",

      "#balance",

      "#dutyBalance",

      "[data-account-credit]",

      "[data-wallet-balance]",

      "[data-user-balance]",

      "[data-credit]",

      "[data-duty]"

    ];


    selectors.forEach(
      selector => {

        $$(selector).forEach(
          element => {

            element.textContent =
              `${formatNumber(credit)} دیوتی`;

          }
        );

      }
    );

  }


  /* =========================================================
     ROOM
     ========================================================= */

  async function getRoom(roomId) {

    if (!roomId) return null;


    const {
      data,
      error
    } = await supabase
      .from(TABLES.rooms)
      .select("*")
      .eq("id", roomId)
      .maybeSingle();


    if (error) {

      console.error(
        "Room error:",
        error
      );

      return null;

    }


    return data || null;

  }


  /* =========================================================
     GET ROOMS
     ========================================================= */

  async function getRooms() {

    const {
      data,
      error
    } = await supabase
      .from(TABLES.rooms)
      .select("*")
      .order(
        "created_at",
        {
          ascending: false
        }
      );


    if (error) {

      console.error(
        "Rooms error:",
        error
      );

      return [];

    }


    return data || [];

  }


  /* =========================================================
     CHECK REGISTRATION
     ========================================================= */

  async function isRegistered(roomId) {

    const userId =
      await getCurrentUserId();


    if (!userId || !roomId) {
      return false;
    }


    const {
      data,
      error
    } = await supabase
      .from(TABLES.registrations)
      .select("id")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .limit(1);


    if (error) {

      console.error(
        "Registration check:",
        error
      );

      return false;

    }


    return Boolean(
      data &&
      data.length > 0
    );

  }


  /* =========================================================
     REGISTER
     ========================================================= */

  async function registerForRoom(
    roomId,
    playerName = ""
  ) {

    const user =
      await getCurrentUser();


    if (!user) {

      showNotice(
        "ابتدا وارد حساب کاربری خود شوید."
      );

      return {
        success: false
      };

    }


    if (!roomId) {

      showNotice(
        "روم انتخاب نشده است."
      );

      return {
        success: false
      };

    }


    /* -----------------------------------------
       روم
       ----------------------------------------- */

    const room =
      await getRoom(roomId);


    if (!room) {

      showNotice(
        "این روم پیدا نشد."
      );

      return {
        success: false
      };

    }


    /* -----------------------------------------
       روم تمام شده
       ----------------------------------------- */

    if (
      room.finished === true ||
      room.status === "finished" ||
      room.status === "closed"
    ) {

      showNotice(
        "این روم به پایان رسیده است."
      );

      return {
        success: false
      };

    }


    /* -----------------------------------------
       ثبت نام قبلی
       ----------------------------------------- */

    const already =
      await isRegistered(roomId);


    if (already) {

      showNotice(
        "شما در این روم ثبت نام کرده‌اید."
      );

      return {
        success: false,
        alreadyRegistered: true
      };

    }


    /* -----------------------------------------
       ثبت نام
       ----------------------------------------- */

    const name =
      playerName ||
      user.user_metadata?.name ||
      user.user_metadata?.full_name ||
      user.email ||
      "بازیکن";


    const {
      data,
      error
    } = await supabase
      .from(TABLES.registrations)
      .insert({

        user_id: user.id,

        room_id: roomId,

        player_name: name,

        registration_date:
          new Date()
            .toISOString()
            .slice(0, 10)

      })
      .select()
      .single();


    if (error) {

      /*
         اگر قبلاً ثبت شده باشد
         Unique Index جلوی ثبت دوباره را می‌گیرد.
      */

      if (
        error.code === "23505"
      ) {

        showNotice(
          "شما در این روم ثبت نام کرده‌اید."
        );

        return {
          success: false,
          alreadyRegistered: true
        };

      }


      console.error(
        "Registration error:",
        error
      );


      showNotice(
        "ثبت نام انجام نشد."
      );


      return {
        success: false
      };

    }


    showNotice(
      "ثبت نام شما با موفقیت انجام شد."
    );


    await loadParticipants(roomId);


    return {
      success: true,
      data
    };

  }


  window.AmirDutyRegisterForRoom =
    registerForRoom;


  /* =========================================================
     PARTICIPANTS
     ========================================================= */

  async function loadParticipants(
    roomId
  ) {

    if (!roomId) {
      return [];
    }


    const {
      data,
      error
    } = await supabase
      .from(TABLES.registrations)
      .select("*")
      .eq("room_id", roomId)
      .order(
        "created_at",
        {
          ascending: true
        }
      );


    if (error) {

      console.error(
        "Participants error:",
        error
      );

      return [];

    }


    renderParticipants(
      data || []
    );


    return data || [];

  }


  function renderParticipants(
    participants
  ) {

    const containers = [

      "#roomParticipants",

      "#participantsList",

      "#registeredPlayers",

      "[data-room-participants]"

    ];


    containers.forEach(
      selector => {

        $$(selector).forEach(
          container => {

            if (
              participants.length === 0
            ) {

              container.innerHTML = `
                <div class="amir-empty-participants">
                  هنوز کسی در این روم ثبت‌نام نکرده است.
                </div>
              `;

              return;
            }


            container.innerHTML = `

              <div class="amir-participants-header">

                <strong>
                  ثبت‌نامی‌های این روم
                </strong>

                <span>
                  ${formatNumber(
                    participants.length
                  )} نفر
                </span>

              </div>


              <div class="amir-participants-list">

                ${participants.map(
                  (person, index) => {

                    const name =
                      person.player_name ||
                      person.name ||
                      person.username ||
                      `بازیکن ${index + 1}`;


                    return `

                      <div
                        class="amir-participant"
                      >

                        <span
                          class="amir-participant-number"
                        >
                          ${formatNumber(
                            index + 1
                          )}
                        </span>

                        <span
                          class="amir-participant-name"
                        >
                          ${escapeHTML(name)}
                        </span>

                      </div>

                    `;

                  }
                ).join("")}

              </div>

            `;

          }
        );

      }
    );

  }


  /* =========================================================
     ROOM CODE
     ========================================================= */

  async function getRoomCode(
    roomId
  ) {

    if (!roomId) return null;


    const {
      data,
      error
    } = await supabase
      .from(TABLES.roomCodes)
      .select("*")
      .eq("room_id", roomId)
      .maybeSingle();


    if (error) {

      console.error(
        "Room code error:",
        error
      );

      return null;

    }


    return data || null;

  }


  /* =========================================================
     CHECK IF USER IS REGISTERED
     ========================================================= */

  async function canSeeRoomCode(
    roomId
  ) {

    const registered =
      await isRegistered(roomId);


    return registered;

  }


  /* =========================================================
     ROOM START CHECK
     ========================================================= */

  async function checkStartedRooms() {

    const userId =
      await getCurrentUserId();


    if (!userId) return;


    const {
      data: registrations,
      error
    } = await supabase
      .from(TABLES.registrations)
      .select(
        "id, room_id"
      )
      .eq(
        "user_id",
        userId
      );


    if (error) {

      console.error(
        "User registrations:",
        error
      );

      return;

    }


    if (
      !registrations ||
      registrations.length === 0
    ) {

      return;

    }


    for (
      const registration
      of registrations
    ) {

      const roomId =
        registration.room_id;


      const code =
        await getRoomCode(
          roomId
        );


      if (!code) continue;


      /*
         فقط زمانی که مدیر روم را شروع کرده
      */

      if (
        code.started !== true
      ) {

        continue;

      }


      const room =
        await getRoom(roomId);


      if (!room) continue;


      showRoomStarted(
        room,
        code
      );

    }

  }


  /* =========================================================
     START ANNOUNCEMENT
     ========================================================= */

  const shownAnnouncements =
    new Set();


  function showRoomStarted(
    room,
    code
  ) {

    const uniqueId =
      `${room.id}-${code.id}-${code.started_at || ""}`;


    if (
      shownAnnouncements.has(
        uniqueId
      )
    ) {

      return;

    }


    shownAnnouncements.add(
      uniqueId
    );


    document
      .getElementById(
        "amir-duty-room-start"
      )
      ?.remove();


    const popup =
      document.createElement(
        "div"
      );


    popup.id =
      "amir-duty-room-start";


    popup.innerHTML = `

      <div class="amir-duty-start-overlay">

        <div class="amir-duty-start-card">

          <button
            class="amir-duty-start-close"
            type="button"
            aria-label="بستن"
          >
            ×
          </button>


          <div class="amir-duty-warning">
            ⚠️
          </div>


          <div class="amir-duty-start-title">

            روم
            ${escapeHTML(
              room.name
            )}
            شروع شده ⚠️

          </div>


          <div class="amir-duty-start-label">

            کد روم

          </div>


          <div class="amir-duty-room-code">

            ${escapeHTML(
              code.code
            )}

          </div>


          <button
            class="amir-duty-copy-code"
            type="button"
          >
            کپی کد
          </button>


        </div>

      </div>

    `;


    document.body.appendChild(
      popup
    );


    popup
      .querySelector(
        ".amir-duty-start-close"
      )
      ?.addEventListener(
        "click",
        () => {

          popup.remove();

        }
      );


    popup
      .querySelector(
        ".amir-duty-copy-code"
      )
      ?.addEventListener(
        "click",
        async event => {

          const button =
            event.currentTarget;


          try {

            await navigator
              .clipboard
              .writeText(
                String(code.code)
              );


            button.textContent =
              "✓ کد کپی شد";


          } catch {

            const textarea =
              document.createElement(
                "textarea"
              );


            textarea.value =
              String(code.code);


            document.body.appendChild(
              textarea
            );


            textarea.select();


            document.execCommand(
              "copy"
            );


            textarea.remove();


            button.textContent =
              "✓ کد کپی شد";

          }


          setTimeout(
            () => {

              if (
                button.isConnected
              ) {

                button.textContent =
                  "کپی کد";

              }

            },
            2000
          );

        }
      );


    requestAnimationFrame(
      () => {

        popup.classList.add(
          "show"
        );

      }
    );

  }


  /* =========================================================
     NOTICE
     ========================================================= */

  function showNotice(
    message
  ) {

    document
      .getElementById(
        "amir-duty-notice"
      )
      ?.remove();


    const notice =
      document.createElement(
        "div"
      );


    notice.id =
      "amir-duty-notice";


    notice.textContent =
      message;


    document.body.appendChild(
      notice
    );


    setTimeout(
      () => {

        notice.classList.add(
          "hide"
        );


        setTimeout(
          () => {

            notice.remove();

          },
          350
        );

      },
      2800
    );

  }


  /* =========================================================
     PUBLIC API
     ========================================================= */

  window.AmirDutyCredit = {

    loadCredit,

    getCurrentUser,

    getCurrentUserId,

    getRoom,

    getRooms,

    isRegistered,

    registerForRoom,

    loadParticipants,

    getRoomCode,

    checkStartedRooms,

    showRoomStarted

  };


  /* =========================================================
     STYLES
     فقط برای قابلیت‌های جدید
     ========================================================= */

  const style =
    document.createElement(
      "style"
    );


  style.textContent = `

    .amir-participants-header {

      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;

      margin-bottom:15px;
      padding:15px 18px;

      border-radius:18px;

      background:
        rgba(255,255,255,.85);

      border:
        1px solid
        rgba(120,72,35,.15);

      font-weight:900;

    }


    .amir-participants-header span {

      padding:6px 12px;

      border-radius:999px;

      background:#784823;

      color:white;

      font-size:13px;

    }


    .amir-participants-list {

      display:grid;

      grid-template-columns:
        repeat(
          auto-fit,
          minmax(190px,1fr)
        );

      gap:10px;

    }


    .amir-participant {

      display:flex;

      align-items:center;

      gap:12px;

      padding:13px 15px;

      border-radius:16px;

      background:
        rgba(255,255,255,.9);

      border:
        1px solid
        rgba(120,72,35,.13);

      transition:.25s ease;

    }


    .amir-participant:hover {

      transform:
        translateY(-3px);

      box-shadow:
        0 10px 25px
        rgba(80,45,20,.12);

    }


    .amir-participant-number {

      width:34px;
      height:34px;

      display:grid;
      place-items:center;

      border-radius:11px;

      background:#784823;

      color:#fff;

      font-weight:900;

      flex:none;

    }


    .amir-participant-name {

      font-weight:800;

      overflow:hidden;

      text-overflow:ellipsis;

      white-space:nowrap;

    }


    .amir-empty-participants {

      padding:24px;

      text-align:center;

      border-radius:18px;

      border:
        1px dashed
        rgba(120,72,35,.25);

      background:
        rgba(120,72,35,.05);

      font-weight:800;

    }


    #amir-duty-room-start {

      position:fixed;

      inset:0;

      z-index:999999;

      opacity:0;

      visibility:hidden;

      transition:
        opacity .4s ease,
        visibility .4s ease;

    }


    #amir-duty-room-start.show {

      opacity:1;

      visibility:visible;

    }


    .amir-duty-start-overlay {

      position:absolute;

      inset:0;

      display:flex;

      align-items:center;

      justify-content:center;

      padding:20px;

      background:
        rgba(30,18,10,.60);

      backdrop-filter:
        blur(16px);

      -webkit-backdrop-filter:
        blur(16px);

    }


    .amir-duty-start-card {

      position:relative;

      width:
        min(560px,94vw);

      padding:34px 25px;

      border-radius:30px;

      text-align:center;

      background:
        rgba(255,255,255,.98);

      border:
        2px solid
        rgba(120,72,35,.18);

      box-shadow:
        0 35px 100px
        rgba(0,0,0,.28);

      transform:
        scale(.8)
        translateY(30px);

      transition:
        .55s
        cubic-bezier(.2,.9,.2,1);

    }


    #amir-duty-room-start.show
    .amir-duty-start-card {

      transform:
        scale(1)
        translateY(0);

    }


    .amir-duty-start-close {

      position:absolute;

      top:12px;
      right:12px;

      width:40px;
      height:40px;

      border:0;

      border-radius:50%;

      background:#f2ebe5;

      color:#784823;

      font-size:25px;

      font-weight:900;

      cursor:pointer;

    }


    .amir-duty-warning {

      font-size:50px;

      margin-bottom:10px;

      animation:
        amir-duty-warning-pulse
        1s infinite;

    }


    .amir-duty-start-title {

      color:#784823;

      font-size:
        clamp(
          24px,
          6vw,
          40px
        );

      line-height:1.5;

      font-weight:1000;

      margin-bottom:15px;

    }


    .amir-duty-start-label {

      font-size:16px;

      font-weight:800;

      opacity:.65;

      margin-bottom:12px;

    }


    .amir-duty-room-code {

      width:100%;

      box-sizing:border-box;

      padding:20px;

      border-radius:22px;

      background:
        linear-gradient(
          135deg,
          #f7f0e9,
          #fff
        );

      border:
        2px solid
        rgba(120,72,35,.18);

      color:#784823;

      font-size:
        clamp(
          32px,
          10vw,
          58px
        );

      line-height:1.2;

      font-weight:1000;

      letter-spacing:3px;

      direction:ltr;

      word-break:break-all;

      user-select:text;

      margin-bottom:15px;

    }


    .amir-duty-copy-code {

      border:0;

      padding:13px 27px;

      border-radius:15px;

      background:#784823;

      color:white;

      font-weight:900;

      font-size:15px;

      cursor:pointer;

      transition:.25s ease;

    }


    .amir-duty-copy-code:hover {

      transform:
        translateY(-3px);

      box-shadow:
        0 12px 28px
        rgba(120,72,35,.25);

    }


    #amir-duty-notice {

      position:fixed;

      left:50%;

      bottom:25px;

      z-index:1000000;

      transform:
        translateX(-50%);

      padding:
        14px 21px;

      border-radius:17px;

      background:#784823;

      color:#fff;

      font-weight:900;

      box-shadow:
        0 12px 35px
        rgba(0,0,0,.2);

      animation:
        amir-duty-notice-in
        .35s ease;

      max-width:
        calc(100vw - 30px);

      text-align:center;

    }


    #amir-duty-notice.hide {

      opacity:0;

      transform:
        translateX(-50%)
        translateY(15px);

      transition:.35s;

    }


    @keyframes
    amir-duty-warning-pulse {

      0%,100% {
        transform:scale(1);
      }

      50% {
        transform:scale(1.15);
      }

    }


    @keyframes
    amir-duty-notice-in {

      from {

        opacity:0;

        transform:
          translateX(-50%)
          translateY(15px)
          scale(.92);

      }

      to {

        opacity:1;

        transform:
          translateX(-50%)
          translateY(0)
          scale(1);

      }

    }


    @media(max-width:600px) {

      .amir-participants-list {

        grid-template-columns:1fr;

      }

      .amir-duty-start-card {

        padding:
          30px 18px;

      }

    }

  `;


  document.head.appendChild(
    style
  );


  /* =========================================================
     INIT
     ========================================================= */

  async function init() {

    await loadCredit();

    await checkStartedRooms();


    /*
       هر 10 ثانیه بررسی می‌کند
       آیا روم جدیدی شروع شده یا نه.
    */

    setInterval(
      async () => {

        await loadCredit();

        await checkStartedRooms();

      },
      10000
    );

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

})();
