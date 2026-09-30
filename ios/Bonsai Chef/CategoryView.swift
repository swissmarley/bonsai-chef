//
//  CategoryView.swift
//  Bonsai Chef
//
//  Created by Nakya Tagli on 11.01.2024.
//

import SwiftUI

struct CategoryView: View {
  var category: Category
  @ObservedObject var bonsaiData: BonsaiData
  var toolCategory: ToolCategory
  @ObservedObject var toolsSupplementsData: ToolsSupplementsData
  var onEditTapped: () -> Void

  var filteredBonsaiRecords: [BonsaiRecord] {
    category == .all ? bonsaiData.records : bonsaiData.records.filter { $0.category.rawValue == category.rawValue }
  }

  var filteredToolRecords: [ToolsSupplementsRecord] {
    toolCategory == .all ? toolsSupplementsData.records : toolsSupplementsData.records.filter { $0.categories.contains(toolCategory) }
  }

  var allRecords: [Any] {
    if category == .category3 {
        return filteredToolRecords
    } else {
        return filteredBonsaiRecords + filteredToolRecords
    }
  }

  var body: some View {
    VStack {
      List {
        if category == .category3 {
          Section(header: Text("Substrati")) {
            ForEach(filteredToolRecords.filter { $0.type == .substract }, id: \.id) { toolRecord in
              NavigationLink(destination: ToolRecordDetailView(record: toolRecord)) {
                Text(toolRecord.toolName)
              }
            }
          }

          Section(header: Text("Bonsai Tools")) {
            ForEach(filteredToolRecords.filter { $0.type == .tool }, id: \.id) { toolRecord in
              NavigationLink(destination: ToolRecordDetailView(record: toolRecord)) {
                Text(toolRecord.toolName)
              }
            }
          }

          Section(header: Text("Accessori")) {
            ForEach(filteredToolRecords.filter { $0.type == .accesoires }, id: \.id) { toolRecord in
              NavigationLink(destination: ToolRecordDetailView(record: toolRecord)) {
                Text(toolRecord.toolName)
              }
            }
          }
        } else {
          ForEach(allRecords.indices, id: \.self) { index in
            let record = allRecords[index]
            if let bonsaiRecord = record as? BonsaiRecord {
              NavigationLink(destination: RecordDetailView(record: bonsaiRecord, onEditTapped: onEditTapped)) {
                Text(bonsaiRecord.name)
              }
            } else if let toolRecord = record as? ToolsSupplementsRecord {
              NavigationLink(destination: ToolRecordDetailView(record: toolRecord)) {
                Text(toolRecord.toolName)
              }
            }
          }
          .onDelete { indexSet in
            for index in indexSet {
              let record = allRecords[index]
              if let bonsaiRecord = record as? BonsaiRecord {
                bonsaiData.records.remove(at: index) // Use index for removal with label
              } else if let toolRecord = record as? ToolsSupplementsRecord {
                toolsSupplementsData.records.remove(at: index) // Use index for removal with label
              }
            }
            bonsaiData.saveRecords() // Save bonsai records after deletion
            toolsSupplementsData.saveRecords() // Save tool records after deletion
          }
        }
      }
      .navigationBarTitle(category == .all ? "Tutti" : category.title)
      .navigationBarItems(trailing: EditButton())
    }
  }
}












