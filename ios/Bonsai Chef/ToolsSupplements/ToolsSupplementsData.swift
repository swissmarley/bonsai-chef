//
//  ToolsSupplementsData.swift
//  Bonsai Chef
//
//  Created by Nakya Tagli on 17.06.2024.
//

import SwiftUI

enum ToolSupplementType: String, CaseIterable, Codable {
    case substract = "Substrati"
    case tool = "Bonsai Tools"
    case accesoires = "Accessori"
}

class ToolsSupplementsRecord: Identifiable, ObservableObject, Codable {
    @Published var id: UUID
    @Published var toolName: String
    @Published var type: ToolSupplementType
    @Published var toolData1: String
    @Published var toolData2: String
    @Published var toolData3: String
    @Published var toolData4: String
    @Published var toolDetails: String
    @Published var toolPhotoPaths: [String]
    @Published var categories: [ToolCategory]
    
    init(toolName: String, type: ToolSupplementType, toolData1: String, toolData2: String, toolData3: String, toolData4: String, toolDetails: String, toolPhotoPaths: [String]) {
        self.id = UUID()
        self.toolName = toolName
        self.type = type
        self.toolData1 = toolData1
        self.toolData2 = toolData2
        self.toolData3 = toolData3
        self.toolData4 = toolData4
        self.toolDetails = toolDetails
        self.toolPhotoPaths = toolPhotoPaths
        self.categories = [.all, .category3]
    }
    
    enum CodingKeys: String, CodingKey {
        case id, toolName, type, toolData1, toolData2, toolData3, toolData4, toolDetails, toolPhotoPaths, categories
    }
    
    required init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(UUID.self, forKey: .id)
        toolName = try container.decode(String.self, forKey: .toolName)
        type = try container.decode(ToolSupplementType.self, forKey: .type)
        toolData1 = try container.decode(String.self, forKey: .toolData1)
        toolData2 = try container.decode(String.self, forKey: .toolData2)
        toolData3 = try container.decode(String.self, forKey: .toolData3)
        toolData4 = try container.decode(String.self, forKey: .toolData4)
        toolDetails = try container.decode(String.self, forKey: .toolDetails)
        toolPhotoPaths = try container.decode([String].self, forKey: .toolPhotoPaths)
        categories = try container.decode([ToolCategory].self, forKey: .categories)
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(toolName, forKey: .toolName)
        try container.encode(type, forKey: .type)
        try container.encode(toolData1, forKey: .toolData1)
        try container.encode(toolData2, forKey: .toolData2)
        try container.encode(toolData3, forKey: .toolData3)
        try container.encode(toolData4, forKey: .toolData4)
        try container.encode(toolDetails, forKey: .toolDetails)
        try container.encode(toolPhotoPaths, forKey: .toolPhotoPaths)
        try container.encode(categories, forKey: .categories)
    }
}

class ToolsSupplementsData: ObservableObject {
    @Published var records: [ToolsSupplementsRecord] = []
    
    init() {
        loadRecords()
    }
    
    func addRecord(_ record: ToolsSupplementsRecord) {
        records.append(record)
        saveRecords()
    }
    
    func updateRecord(_ record: ToolsSupplementsRecord) {
        if let index = records.firstIndex(where: { $0.id == record.id }) {
            records[index] = record
            saveRecords()
        }
    }
    
    func deleteRecord(_ record: ToolsSupplementsRecord) {
        if let index = records.firstIndex(where: { $0.id == record.id }) {
            records.remove(at: index)
            saveRecords()
        }
    }
    
    func saveRecords() {
        let encoder = JSONEncoder()
        if let encodedData = try? encoder.encode(records) {
            UserDefaults.standard.set(encodedData, forKey: "ToolsSupplementsRecords")
        }
    }
    
    func loadRecords() {
        if let data = UserDefaults.standard.data(forKey: "ToolsSupplementsRecords") {
            let decoder = JSONDecoder()
            if let decodedRecords = try? decoder.decode([ToolsSupplementsRecord].self, from: data) {
                records = decodedRecords
            }
        }
    }
}

