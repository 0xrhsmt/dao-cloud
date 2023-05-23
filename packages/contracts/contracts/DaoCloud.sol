// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@tableland/evm/contracts/utils/TablelandDeployments.sol";
import "@tableland/evm/contracts/utils/SQLHelpers.sol";

contract DaoCloud is
    ERC721HolderUpgradeable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    string private _table;
    uint256 private _tableId;
    string private _tablePrefix;

    event FileTouched(address caller, string path, string url);
    event DirectoryMade(address caller, string path);
    event FileMoved(address caller, string sourcePath, string destinationPath);
    event DirectoryMoved(address caller, string sourceDir, string destinationDir);
    event FileDirectoryRemoved(address caller, string path);

    function initialize() public initializer {
        __ERC721Holder_init();
        __Ownable_init_unchained();
        __Pausable_init();
        __ReentrancyGuard_init();

        _tablePrefix = "daocloud";
    }

    /*
     * `createTable` initializes the token tables.
     */
    function createTable() external payable onlyOwner returns (uint256) {
        _tableId = TablelandDeployments.get().create(
            address(this),
            /*
             *  CREATE TABLE prefix_chainId (
             *    int id,
             *    int x,
             *    int y
             *  );
             */
            SQLHelpers.toCreateFromSchema(
                "id INTEGER PRIMARY KEY, path TEXT NOT NULL, file TEXT NOT NULL, url TEXT NOT NULL",
                _tablePrefix
            )
        );

        _table = SQLHelpers.toNameFromId(_tablePrefix, _tableId);

        return _tableId;
    }

    function touch(
        string calldata path,
        string calldata file,
        string calldata url
    ) external {
        TablelandDeployments.get().mutate(
            address(this),
            _tableId,
            SQLHelpers.toInsert(
                _tablePrefix,
                _tableId,
                "path,file,url",
                string.concat(
                    SQLHelpers.quote(path),
                    ",",
                    SQLHelpers.quote(file),
                    ",",
                    SQLHelpers.quote(url)
                )
            )
        );

        emit FileTouched(msg.sender, path, url);
    }

    function mv(
        string calldata sourcePath,
        string calldata destinationPath
    ) external {
        string memory setters = string.concat(
            "path=",
            "REPLACE(path, ",
            SQLHelpers.quote(sourcePath),
            ", ",
            SQLHelpers.quote(destinationPath),
            ")"
        );

        string memory filters = string.concat(
            "path like ",
            SQLHelpers.quote(string.concat(sourcePath, "%")),
            " and path != ",
            SQLHelpers.quote(sourcePath)
        );

        TablelandDeployments.get().mutate(
            address(this),
            _tableId,
            SQLHelpers.toUpdate(_tablePrefix, _tableId, setters, filters)
        );

        emit DirectoryMoved(msg.sender, sourcePath, destinationPath);
    }

    function mv(
        string calldata sourcePath,
        string calldata destinationPath,
        string calldata destinationFile
    ) external {
        string memory setters = string.concat(
            "path=",
            SQLHelpers.quote(destinationPath),
            ",  file=",
            SQLHelpers.quote(destinationFile)
        );

        string memory filters = string.concat(
            "path=",
            SQLHelpers.quote(sourcePath)
        );

        TablelandDeployments.get().mutate(
            address(this),
            _tableId,
            SQLHelpers.toUpdate(_tablePrefix, _tableId, setters, filters)
        );

        emit FileMoved(msg.sender, sourcePath, destinationPath);
    }

    function rm(string calldata path) external {
        string memory filters = string.concat(
            "path like ",
            SQLHelpers.quote(string.concat(path, "%"))
        );

        TablelandDeployments.get().mutate(
            address(this),
            _tableId,
            SQLHelpers.toDelete(_tablePrefix, _tableId, filters)
        );

        emit FileDirectoryRemoved(msg.sender, path);
    }

    /**
     * @dev See {UUPSUpgradeable-_authorizeUpgrade}.
     */
    function _authorizeUpgrade(address) internal view override onlyOwner {} // solhint-disable no-empty-blocks
}
