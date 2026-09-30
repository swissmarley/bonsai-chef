//
//  BonsaiDataModel.swift
//  Bonsai Chef
//
//  Created by Nakya Tagli on 08.01.2024.
//

import SwiftUI

let months = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"]

class BonsaiRecord: Identifiable, ObservableObject, Codable {
    @Published var id: UUID = UUID()
    @Published var name: String
    @Published var category: BonsaiCategory
    @Published var data1: String
    @Published var data2: String
    @Published var dateDS1: Date
    @Published var selectedStartMonthDS1: Int
    @Published var selectedEndMonthDS1: Int
    @Published var detailsDS1: String
    @Published var selectedStartMonthDS2: Int
    @Published var selectedEndMonthDS2: Int
    @Published var detailsDS2: String
    @Published var selectedStartMonthDS3: Int
    @Published var selectedEndMonthDS3: Int
    @Published var detailsDS3: String
    @Published var dateDS4: Date
    @Published var selectedStartMonthDS4: Int
    @Published var selectedEndMonthDS4: Int
    @Published var detailsDS4: String
    @Published var selectedStartMonthDS5: Int
    @Published var selectedEndMonthDS5: Int
    @Published var detailsDS5: String
    @Published var dataDS6: String
    @Published var selectedStartMonthDS6: Int
    @Published var selectedEndMonthDS6: Int
    @Published var detailsDS6: String
    @Published var photoPaths: [String]

    init(name: String, category: BonsaiCategory, data1: String, data2: String, dateDS1: Date, selectedStartMonthDS1: Int, selectedEndMonthDS1: Int, detailsDS1: String, selectedStartMonthDS2: Int, selectedEndMonthDS2: Int, detailsDS2: String, selectedStartMonthDS3: Int, selectedEndMonthDS3: Int, detailsDS3: String, dateDS4: Date, selectedStartMonthDS4: Int, selectedEndMonthDS4: Int, detailsDS4: String, selectedStartMonthDS5: Int, selectedEndMonthDS5: Int, detailsDS5: String, dataDS6: String, selectedStartMonthDS6: Int, selectedEndMonthDS6: Int, detailsDS6: String, photoPaths: [String]) {
        self.name = name
        self.category = category
        self.data1 = data1
        self.data2 = data2
        self.dateDS1 = dateDS1
        self.selectedStartMonthDS1 = selectedStartMonthDS1
        self.selectedEndMonthDS1 = selectedEndMonthDS1
        self.detailsDS1 = detailsDS1
        self.selectedStartMonthDS2 = selectedStartMonthDS2
        self.selectedEndMonthDS2 = selectedEndMonthDS2
        self.detailsDS2 = detailsDS2
        self.selectedStartMonthDS3 = selectedStartMonthDS3
        self.selectedEndMonthDS3 = selectedEndMonthDS3
        self.detailsDS3 = detailsDS3
        self.dateDS4 = dateDS4
        self.selectedStartMonthDS4 = selectedStartMonthDS4
        self.selectedEndMonthDS4 = selectedEndMonthDS4
        self.detailsDS4 = detailsDS4
        self.selectedStartMonthDS5 = selectedStartMonthDS5
        self.selectedEndMonthDS5 = selectedEndMonthDS5
        self.detailsDS5 = detailsDS5
        self.dataDS6 = dataDS6
        self.selectedStartMonthDS6 = selectedStartMonthDS6
        self.selectedEndMonthDS6 = selectedEndMonthDS6
        self.detailsDS6 = detailsDS6
        self.photoPaths = photoPaths
    }

    enum CodingKeys: String, CodingKey {
        case id, name, category, data1, data2, dateDS1, selectedStartMonthDS1, selectedEndMonthDS1, detailsDS1, selectedStartMonthDS2, selectedEndMonthDS2, detailsDS2, selectedStartMonthDS3, selectedEndMonthDS3, detailsDS3, dateDS4, selectedStartMonthDS4, selectedEndMonthDS4, detailsDS4, selectedStartMonthDS5, selectedEndMonthDS5, detailsDS5, dataDS6, selectedStartMonthDS6, selectedEndMonthDS6, detailsDS6, photoPaths
    }

    required init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(UUID.self, forKey: .id)
        name = try container.decode(String.self, forKey: .name)
        category = try container.decode(BonsaiCategory.self, forKey: .category)
        data1 = try container.decode(String.self, forKey: .data1)
        data2 = try container.decode(String.self, forKey: .data2)
        dateDS1 = try container.decode(Date.self, forKey: .dateDS1)
        selectedStartMonthDS1 = try container.decode(Int.self, forKey: .selectedStartMonthDS1)
        selectedEndMonthDS1 = try container.decode(Int.self, forKey: .selectedEndMonthDS1)
        detailsDS1 = try container.decode(String.self, forKey: .detailsDS1)
        selectedStartMonthDS2 = try container.decode(Int.self, forKey: .selectedStartMonthDS2)
        selectedEndMonthDS2 = try container.decode(Int.self, forKey: .selectedEndMonthDS2)
        detailsDS2 = try container.decode(String.self, forKey: .detailsDS2)
        selectedStartMonthDS3 = try container.decode(Int.self, forKey: .selectedStartMonthDS3)
        selectedEndMonthDS3 = try container.decode(Int.self, forKey: .selectedEndMonthDS3)
        detailsDS3 = try container.decode(String.self, forKey: .detailsDS3)
        dateDS4 = try container.decode(Date.self, forKey: .dateDS4)
        selectedStartMonthDS4 = try container.decode(Int.self, forKey: .selectedStartMonthDS4)
        selectedEndMonthDS4 = try container.decode(Int.self, forKey: .selectedEndMonthDS4)
        detailsDS4 = try container.decode(String.self, forKey: .detailsDS4)
        selectedStartMonthDS5 = try container.decode(Int.self, forKey: .selectedStartMonthDS5)
        selectedEndMonthDS5 = try container.decode(Int.self, forKey: .selectedEndMonthDS5)
        detailsDS5 = try container.decode(String.self, forKey: .detailsDS5)
        dataDS6 = try container.decode(String.self, forKey: .dataDS6)
        selectedStartMonthDS6 = try container.decode(Int.self, forKey: .selectedStartMonthDS6)
        selectedEndMonthDS6 = try container.decode(Int.self, forKey: .selectedEndMonthDS6)
        detailsDS6 = try container.decode(String.self, forKey: .detailsDS6)
        photoPaths = try container.decode([String].self, forKey: .photoPaths)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(name, forKey: .name)
        try container.encode(category, forKey: .category)
        try container.encode(data1, forKey: .data1)
        try container.encode(data2, forKey: .data2)
        try container.encode(dateDS1, forKey: .dateDS1)
        try container.encode(selectedStartMonthDS1, forKey: .selectedStartMonthDS1)
        try container.encode(selectedEndMonthDS1, forKey: .selectedEndMonthDS1)
        try container.encode(detailsDS1, forKey: .detailsDS1)
        try container.encode(selectedStartMonthDS2, forKey: .selectedStartMonthDS2)
        try container.encode(selectedEndMonthDS2, forKey: .selectedEndMonthDS2)
        try container.encode(detailsDS2, forKey: .detailsDS2)
        try container.encode(selectedStartMonthDS3, forKey: .selectedStartMonthDS3)
        try container.encode(selectedEndMonthDS3, forKey: .selectedEndMonthDS3)
        try container.encode(detailsDS3, forKey: .detailsDS3)
        try container.encode(dateDS4, forKey: .dateDS4)
        try container.encode(selectedStartMonthDS4, forKey: .selectedStartMonthDS4)
        try container.encode(selectedEndMonthDS4, forKey: .selectedEndMonthDS4)
        try container.encode(detailsDS4, forKey: .detailsDS4)
        try container.encode(selectedStartMonthDS5, forKey: .selectedStartMonthDS5)
        try container.encode(selectedEndMonthDS5, forKey: .selectedEndMonthDS5)
        try container.encode(detailsDS5, forKey: .detailsDS5)
        try container.encode(dataDS6, forKey: .dataDS6)
        try container.encode(selectedStartMonthDS6, forKey: .selectedStartMonthDS6)
        try container.encode(selectedEndMonthDS6, forKey: .selectedEndMonthDS6)
        try container.encode(detailsDS6, forKey: .detailsDS6)
        try container.encode(photoPaths, forKey: .photoPaths)
    }
}  

class BonsaiData: ObservableObject {
    @Published var records: [BonsaiRecord] = []

    init() {
        loadRecords()
        requestNotificationPermission()
    }
    
    func requestNotificationPermission() {
            UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
                if granted {
                    print("Permesso di notifica concesso.")
                } else if let error = error {
                    print("Permesso di notifica negata: \(error.localizedDescription)")
                }
            }
        }

    func saveRecords() {
        let encoder = JSONEncoder()
        if let encodedRecords = try? encoder.encode(records) {
            UserDefaults.standard.set(encodedRecords, forKey: "bonsaiRecords")
        }
    }

    func loadRecords() {
        if let savedRecordsData = UserDefaults.standard.data(forKey: "bonsaiRecords") {
            let decoder = JSONDecoder()
            if let savedRecords = try? decoder.decode([BonsaiRecord].self, from: savedRecordsData) {
                records = savedRecords
            }
        }
    }

    func editRecord(record: BonsaiRecord, updatedName: String, updatedCategory: BonsaiCategory, updatedData1: String, updatedData2: String, updatedDateDS1: Date, updatedselectedStartMonthDS1: Int, updatedselectedEndMonthDS1: Int, updatedDetailsDS1: String, updatedselectedStartMonthDS2: Int, updatedselectedEndMonthDS2: Int, updatedDetailsDS2: String, updatedselectedStartMonthDS3: Int, updatedselectedEndMonthDS3: Int, updatedDetailsDS3: String, updatedDateDS4: Date, updatedselectedStartMonthDS4: Int, updatedselectedEndMonthDS4: Int, updatedDetailsDS4: String, updatedselectedStartMonthDS5: Int, updatedselectedEndMonthDS5: Int, updatedDetailsDS5: String, updatedDataDS6: String, updatedselectedStartMonthDS6: Int, updatedselectedEndMonthDS6: Int, updatedDetailsDS6: String, updatedPhotos: [String]) {
        if let index = records.firstIndex(where: { $0.id == record.id }) {
            records[index].name = updatedName
            records[index].category = updatedCategory
            records[index].data1 = updatedData1
            records[index].data2 = updatedData2
            records[index].dateDS1 = updatedDateDS1
            records[index].selectedStartMonthDS1 = updatedselectedStartMonthDS1
            records[index].selectedEndMonthDS1 = updatedselectedEndMonthDS1
            records[index].detailsDS1 = updatedDetailsDS1
            records[index].selectedStartMonthDS2 = updatedselectedStartMonthDS2
            records[index].selectedEndMonthDS2 = updatedselectedEndMonthDS2
            records[index].detailsDS2 = updatedDetailsDS2
            records[index].selectedStartMonthDS3 = updatedselectedStartMonthDS3
            records[index].selectedEndMonthDS3 = updatedselectedEndMonthDS3
            records[index].detailsDS3 = updatedDetailsDS3
            records[index].dateDS4 = updatedDateDS4
            records[index].selectedStartMonthDS4 = updatedselectedStartMonthDS4
            records[index].selectedEndMonthDS4 = updatedselectedEndMonthDS4
            records[index].detailsDS4 = updatedDetailsDS4
            records[index].selectedStartMonthDS5 = updatedselectedStartMonthDS5
            records[index].selectedEndMonthDS5 = updatedselectedEndMonthDS5
            records[index].detailsDS5 = updatedDetailsDS5
            records[index].dataDS6 = updatedDataDS6
            records[index].selectedStartMonthDS6 = updatedselectedStartMonthDS6
            records[index].selectedEndMonthDS6 = updatedselectedEndMonthDS6
            records[index].detailsDS6 = updatedDetailsDS6
            records[index].photoPaths = updatedPhotos
        }
    }
}

extension BonsaiData {
    func scheduleNotification(for record: BonsaiRecord, message: String, date: Date) {
        let content = UNMutableNotificationContent()
        content.title = "Promemoria Bonsai Chef"
        content.body = message
        content.sound = .default
        
        let triggerDate = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: date)
        let trigger = UNCalendarNotificationTrigger(dateMatching: triggerDate, repeats: false)
        
        let request = UNNotificationRequest(identifier: record.id.uuidString, content: content, trigger: trigger)
        
        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                print("Error scheduling notification: \(error.localizedDescription)")
            }
        }
    }
    
    func cancelNotification(for record: BonsaiRecord) {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [record.id.uuidString])
    }
    
    func editNotification(for record: BonsaiRecord, newMessage: String, newDate: Date) {
        cancelNotification(for: record)
        scheduleNotification(for: record, message: newMessage, date: newDate)
    }
}



