from django.apps import AppConfig


class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api'

    def ready(self):
        """
        Called once when Django starts.
        Applies the global LangChain token-tracking patch and prints a banner.
        """
        try:
            from django.conf import settings
            from api.services.token_tracker import _patch_langchain_defaults

            _patch_langchain_defaults()

            backend = (
                "Gemini API  ☁️"
                if getattr(settings, "IS_PRODUCTION", False)
                else "Ollama (local)  🦙"
            )

            print(
                "\n" + "═" * 62 + "\n"
                "  📊  TOKEN TRACKER ACTIVE\n"
                f"  AI Backend : {backend}\n"
                "  Every Ollama / Gemini / LangChain call will be counted.\n"
                "  Totals reset when the server restarts.\n"
                + "═" * 62 + "\n",
                flush=True,
            )

        except Exception as exc:
            import logging
            logging.getLogger(__name__).warning(
                "token_tracker startup patch failed: %s", exc
            )
