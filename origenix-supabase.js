(() => {
  "use strict";

  const url = "https://kdlyjcaxopypqeitazan.supabase.co";
  const publishableKey = "sb_publishable_WPAmKMxTATKGybLe9FBs1Q_X417Hc5X";

  function createClient(options) {
    const factory = window.supabase?.createClient;
    if (typeof factory !== "function") {
      throw new Error("Cliente Supabase indisponível. Verifique sua conexão e tente novamente.");
    }

    return factory(url, publishableKey, options);
  }

  window.OrigenixSupabase = Object.freeze({
    url,
    publishableKey,
    createClient,
  });
})();
