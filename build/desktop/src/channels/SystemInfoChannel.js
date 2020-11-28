"use strict";
exports.__esModule = true;
exports.SystemInfoChannel = void 0;
var child_process_1 = require("child_process");
/**
 * Left this in as an example of how to use the return-channel to send data back to the webapp.
 */
var SystemInfoChannel = /** @class */ (function () {
    function SystemInfoChannel() {
    }
    SystemInfoChannel.prototype.getName = function () {
        return "system-info";
    };
    SystemInfoChannel.prototype.handle = function (event, request) {
        if (!request.responseChannel) {
            request.responseChannel = this.getName() + "_response";
        }
        event.sender.send(request.responseChannel, {
            kernel: child_process_1.execSync("uname -a").toString()
        });
    };
    return SystemInfoChannel;
}());
exports.SystemInfoChannel = SystemInfoChannel;
//# sourceMappingURL=SystemInfoChannel.js.map