"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
exports.PickFileChannel = void 0;
var electron = require("electron");
var IPCRequest = require("../../../common/src/Core/IPC/IPCRequest");
var jetpack = require("fs-jetpack");
var PickFileChannel = /** @class */ (function () {
    function PickFileChannel(mainWindow) {
        this.mainWindow = mainWindow;
        console.log("Instantiating PickFileChannel");
    }
    PickFileChannel.prototype.getName = function () {
        return IPCRequest.PICK_FILE;
    };
    PickFileChannel.prototype.handle = function (event, request) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, title, message, filters, defaultPath, config;
            var _this = this;
            return __generator(this, function (_b) {
                if (request.params.type !== IPCRequest.PICK_FILE) {
                    return [2 /*return*/];
                }
                _a = request.params, title = _a.title, message = _a.message, filters = _a.filters, defaultPath = _a.defaultPath;
                config = {
                    title: title,
                    message: message,
                    filters: filters
                };
                if (defaultPath) {
                    config.defaultPath = defaultPath;
                }
                console.log("Creating Dialog", request.params);
                electron.dialog
                    .showSaveDialog(this.mainWindow, config)
                    .then(function (_a) {
                    var filePath = _a.filePath, canceled = _a.canceled;
                    var enforcedFileName;
                    if (!canceled && filePath) {
                        var parsedFileName = filePath.split(".");
                        var extension = filters[0].extensions[0];
                        if (parsedFileName[parsedFileName.length - 1] !== extension) {
                            parsedFileName.push(extension);
                        }
                        enforcedFileName = parsedFileName.join(".");
                        jetpack.file(enforcedFileName);
                    }
                    if (!request.responseChannel) {
                        request.responseChannel = _this.getName() + "_response";
                    }
                    console.log("File Picked:", enforcedFileName);
                    event.sender.send(request.responseChannel, enforcedFileName);
                });
                return [2 /*return*/];
            });
        });
    };
    return PickFileChannel;
}());
exports.PickFileChannel = PickFileChannel;
//# sourceMappingURL=PickFileChannel.js.map