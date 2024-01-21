import glob
import json
import os
import time
import traceback

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")


def delete_old_logs(self):
    one_week_ago = time.time() - 7 * 24 * 60 * 60  # Time stamp one week ago
    for log_file in glob.glob('./logs/logs_*.txt'):
        if os.path.getmtime(log_file) < one_week_ago:
            os.remove(log_file)


class LoggerClass:
    def __init__(self):
        self.logs = []

    def debug(self, msg, properties=None):
        if LOG_LEVEL == "DEBUG":
            self._log('DEBUG', msg, properties)

    def info(self, msg, properties=None):
        self._log('INFO', msg, properties)

    def warn(self, msg, properties=None):
        self._log('WARN', msg, properties)

    def error(self, msg, properties=None):
        if properties and isinstance(properties.get("error"), BaseException):
            properties["error"] = self._serialize_exception(properties["error"])
        self._log('ERROR', msg, properties)

    def _serialize_exception(self, e):
        return "".join(traceback.format_exception(None, e, e.__traceback__))

    def _log(self, level, msg, properties=None):
        log_entry = {"level": level, "msg": msg, "properties": properties,
                     "timestamp": time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime())}
        self.logs.append(log_entry)

    def flush(self):
        log_filename = './logs/logs_' + time.strftime("%Y%m%d") + '.txt'  # Creates file name like 'logs_20220101.txt'
        with open(log_filename, 'a') as log_file:
            for log in self.logs:
                try:
                    log_line = f"[{log['timestamp']}][{log['level']}]: {log['msg']}"
                    if log['properties']:
                        log_line += f" - {json.dumps(log['properties'])}"
                    print(log_line)  # Print to console
                    log_file.write(log_line + '\n')  # Write to file
                except Exception as e:
                    print(f"Failed to write log to file: {e}")
        self.logs = []  # Clear logs in memory
        delete_old_logs(self)


logger = LoggerClass()
