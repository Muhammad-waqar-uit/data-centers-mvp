// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

/// @title DataCenterRegistry
/// @notice On-chain registry for data center metadata (location, status, ownership)
contract DataCenterRegistry {
    enum DCStatus {
        UNKNOWN,
        PLANNED,
        UNDER_CONSTRUCTION,
        OPERATING,
        STALLED,
        DECOMMISSIONED
    }

    enum OwnerType {
        UNKNOWN,
        PUBLIC_COMPANY,
        PRIVATE_COMPANY,
        FUND,
        SOVEREIGN_ENTITY,
        GOVERNMENT,
        JOINT_VENTURE
    }

    /// @notice Core data center record (kept small to avoid stack issues)
    struct DataCenter {
        uint256 id;
        string name;
        int256 latitude;   // scaled by 1e6
        int256 longitude;  // scaled by 1e6
        string country;
        DCStatus status;
        address owner;
        bool isActive;
        uint256 registeredAt;
        uint256 updatedAt;
    }

    /// @notice Extended metadata stored separately
    struct DataCenterMeta {
        string region;
        OwnerType ownerType;
        uint256 powerCapacityMW;
        uint256 sizeMW;
        string description;
    }

    // State
    uint256 public nextId;
    mapping(uint256 => DataCenter) public dataCenters;
    mapping(uint256 => DataCenterMeta) public dataCenterMeta;
    mapping(address => uint256[]) public ownerDataCenters;

    // Access control
    address public owner;
    mapping(address => bool) public authorizedRegistrars;

    // Events
    event DataCenterRegistered(uint256 indexed id, string name, address indexed registeredBy);
    event DataCenterUpdated(uint256 indexed id, DCStatus newStatus, address indexed updatedBy);
    event DataCenterMetaUpdated(uint256 indexed id);
    event DataCenterDeactivated(uint256 indexed id);
    event RegistrarAdded(address indexed registrar);
    event RegistrarRemoved(address indexed registrar);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "DataCenterRegistry: caller is not the owner");
        _;
    }

    modifier onlyAuthorized() {
        require(
            msg.sender == owner || authorizedRegistrars[msg.sender],
            "DataCenterRegistry: not authorized"
        );
        _;
    }

    constructor() {
        owner = msg.sender;
        nextId = 1;
    }

    // ─── Registration ───────────────────────────────────────────

    /// @notice Register a new data center with core fields
    function registerDataCenter(
        string calldata _name,
        int256 _latitude,
        int256 _longitude,
        string calldata _country,
        DCStatus _status,
        address _ownerAddress
    ) external onlyAuthorized returns (uint256) {
        require(bytes(_name).length > 0, "DataCenterRegistry: name required");
        require(_ownerAddress != address(0), "DataCenterRegistry: zero owner address");

        uint256 id = nextId++;

        dataCenters[id] = DataCenter({
            id: id,
            name: _name,
            latitude: _latitude,
            longitude: _longitude,
            country: _country,
            status: _status,
            owner: _ownerAddress,
            isActive: true,
            registeredAt: block.timestamp,
            updatedAt: block.timestamp
        });

        ownerDataCenters[_ownerAddress].push(id);

        emit DataCenterRegistered(id, _name, msg.sender);
        return id;
    }

    /// @notice Set or update extended metadata for a data center
    function setMeta(
        uint256 _id,
        string calldata _region,
        OwnerType _ownerType,
        uint256 _powerCapacityMW,
        uint256 _sizeMW,
        string calldata _description
    ) external onlyAuthorized {
        require(dataCenters[_id].isActive, "DataCenterRegistry: not active");

        dataCenterMeta[_id] = DataCenterMeta({
            region: _region,
            ownerType: _ownerType,
            powerCapacityMW: _powerCapacityMW,
            sizeMW: _sizeMW,
            description: _description
        });

        dataCenters[_id].updatedAt = block.timestamp;
        emit DataCenterMetaUpdated(_id);
    }

    // ─── Updates ────────────────────────────────────────────────

    function updateStatus(uint256 _id, DCStatus _newStatus) external onlyAuthorized {
        require(dataCenters[_id].isActive, "DataCenterRegistry: not active");
        dataCenters[_id].status = _newStatus;
        dataCenters[_id].updatedAt = block.timestamp;
        emit DataCenterUpdated(_id, _newStatus, msg.sender);
    }

    function deactivate(uint256 _id) external onlyOwner {
        require(dataCenters[_id].isActive, "DataCenterRegistry: already inactive");
        dataCenters[_id].isActive = false;
        dataCenters[_id].updatedAt = block.timestamp;
        emit DataCenterDeactivated(_id);
    }

    // ─── Views ──────────────────────────────────────────────────

    function getDataCenter(uint256 _id) external view returns (DataCenter memory) {
        require(dataCenters[_id].isActive || _id < nextId, "DataCenterRegistry: not found");
        return dataCenters[_id];
    }

    function getMeta(uint256 _id) external view returns (DataCenterMeta memory) {
        return dataCenterMeta[_id];
    }

    function getDataCentersByOwner(address _ownerAddress) external view returns (uint256[] memory) {
        return ownerDataCenters[_ownerAddress];
    }

    function getTotalRegistered() external view returns (uint256) {
        return nextId - 1;
    }

    // ─── Access Control ─────────────────────────────────────────

    function addRegistrar(address _registrar) external onlyOwner {
        authorizedRegistrars[_registrar] = true;
        emit RegistrarAdded(_registrar);
    }

    function removeRegistrar(address _registrar) external onlyOwner {
        authorizedRegistrars[_registrar] = false;
        emit RegistrarRemoved(_registrar);
    }

    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "DataCenterRegistry: zero address");
        emit OwnershipTransferred(owner, _newOwner);
        owner = _newOwner;
    }
}
