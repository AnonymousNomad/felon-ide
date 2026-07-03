"""Model plugin interface — any model can plug into the IDE."""

class ModelPlugin:
    name = "base"
    version = "0.1"
    description = "Base model plugin"

    def register_commands(self):
        """Return dict of {command_name: handler_fn(cmd_string, server) -> [output_lines]}"""
        return {}

    def register_endpoints(self):
        """Return dict of {api_path: handler_fn(body, server) -> dict}"""
        return {}

    def on_start(self, server):
        """Called after server starts. `server` provides access to core services."""
        pass

    def get_info(self):
        return {
            "name": self.name,
            "version": self.version,
            "description": self.description,
            "loaded": True,
        }
