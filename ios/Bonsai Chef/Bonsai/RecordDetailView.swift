//
//  RecordDetailView.swift
//  Bonsai Chef
//
//  Created by Nakya Tagli on 08.01.2024.
//

import SwiftUI
import UserNotifications

struct RecordDetailView: View {
    @EnvironmentObject var bonsaiData: BonsaiData
    @ObservedObject var record: BonsaiRecord
    var onEditTapped: () -> Void
    
    @State private var isEditViewPresented = false
    @State private var isReminderViewPresented = false
    @State private var reminderMessage: String = ""
    @State private var reminderDate: Date = Date()
    @State private var editedName: String = ""
    @State private var editedCategory: BonsaiCategory = .category1
    @State private var editedData1: String = ""
    @State private var editedData2: String = ""
    @State private var editedDateDS1: Date = Date()
    @State private var editedStartMonthDS1: Int
    @State private var editedEndMonthDS1: Int
    @State private var editedDetailsDS1: String = ""
    @State private var editedStartMonthDS2: Int
    @State private var editedEndMonthDS2: Int
    @State private var editedDetailsDS2: String = ""
    @State private var editedStartMonthDS3: Int
    @State private var editedEndMonthDS3: Int
    @State private var editedDetailsDS3: String = ""
    @State private var editedDateDS4: Date = Date()
    @State private var editedStartMonthDS4: Int
    @State private var editedEndMonthDS4: Int
    @State private var editedDetailsDS4: String = ""
    @State private var editedStartMonthDS5: Int
    @State private var editedEndMonthDS5: Int
    @State private var editedDetailsDS5: String = ""
    @State private var editedDataDS6: String = ""
    @State private var editedStartMonthDS6: Int
    @State private var editedEndMonthDS6: Int
    @State private var editedDetailsDS6: String = ""
    @State private var editedPhotos: [UIImage] = []
    
    // New state variables for image viewing
    @State private var isImageFullScreenPresented = false
    @State private var selectedImage: UIImage?
    @Environment(\.presentationMode) var presentationMode
    
    init(record: BonsaiRecord, onEditTapped: @escaping () -> Void) {
        self.record = record
        self.onEditTapped = onEditTapped
        self.editedStartMonthDS1 = record.selectedStartMonthDS1
        self.editedEndMonthDS1 = record.selectedEndMonthDS1 // Initialize state variables with record values
        self.editedStartMonthDS2 = record.selectedStartMonthDS2
        self.editedEndMonthDS2 = record.selectedEndMonthDS2
        self.editedStartMonthDS3 = record.selectedStartMonthDS3
        self.editedEndMonthDS3 = record.selectedEndMonthDS3
        self.editedStartMonthDS4 = record.selectedStartMonthDS4
        self.editedEndMonthDS4 = record.selectedEndMonthDS4
        self.editedStartMonthDS5 = record.selectedStartMonthDS5
        self.editedEndMonthDS5 = record.selectedEndMonthDS5
        self.editedStartMonthDS6 = record.selectedStartMonthDS6
        self.editedEndMonthDS6 = record.selectedEndMonthDS6
    }
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack {
                    Text(record.name)
                        .font(.title)
                    Text(record.category.rawValue)
                        .foregroundColor(.secondary)
                        .padding()
                    Text("Substrato: \(record.data1)")
                    Text("Vaso: \(record.data2)")
                        .padding()
                    
                    Text("Rinvaso")
                        .font(.headline)
                        .padding()
                    Text("Ultimo Rinvaso: \(record.dateDS1, formatter: dateFormatter)")
                        .padding()
                    Text("Periodo Migliore: \(months[record.selectedStartMonthDS1]) - \(months[record.selectedEndMonthDS1])")
                        .padding()
                    Text(record.detailsDS1)
                        .padding()
                    
                    Text("Potatura")
                        .font(.headline)
                        .padding()
                    Text("Periodo Migliore: \(months[record.selectedStartMonthDS2]) - \(months[record.selectedEndMonthDS2])")
                        .padding()
                    Text(record.detailsDS2)
                        .padding()
                    
                    Text("Taglio Germogli")
                        .font(.headline)
                        .padding()
                    Text("Periodo Migliore: \(months[record.selectedStartMonthDS3]) - \(months[record.selectedEndMonthDS3])")
                        .padding()
                    Text(record.detailsDS3)
                        .padding()
                    
                    Text("Applicazione Filo")
                        .font(.headline)
                        .padding()
                    Text("Ultima Applicazione: \(record.dateDS4, formatter: dateFormatter)")
                        .padding()
                    Text("Periodo Migliore: \(months[record.selectedStartMonthDS4]) - \(months[record.selectedEndMonthDS4])")
                        .padding()
                    Text(record.detailsDS4)
                        .padding()
                    
                    Text("Defogliazione")
                        .font(.headline)
                        .padding()
                    Text("Periodo Migliore: \(months[record.selectedStartMonthDS5]) - \(months[record.selectedEndMonthDS5])")
                        .padding()
                    Text(record.detailsDS5)
                        .padding()
                    
                    Text("Concimazione")
                        .font(.headline)
                        .padding()
                    Text("Tipologia di Concime: \(record.dataDS6)")
                    Text("Periodo Migliore: \(months[record.selectedStartMonthDS6]) - \(months[record.selectedEndMonthDS6])")
                        .padding()
                    Text(record.detailsDS6)
                        .padding()
                    
                    Text("Fotos:")
                        .font(.headline)
                        .padding([.top, .bottom])
                    // Photo Grid
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 100))]) {
                        ForEach(record.photoPaths, id: \.self) { photoPath in
                            AsyncImage(imagePath: photoPath)
                                .cornerRadius(5)
                                .padding(5)
                                .onTapGesture {
                                    selectedImage = loadImageFromDisk(with: photoPath)
                                    isImageFullScreenPresented = true
                                }
                        }
                    }
                    .navigationTitle(record.name)
                    .navigationBarTitleDisplayMode(.inline)
                }
            }
        }
        .navigationBarTitle(record.name)
        .navigationBarItems(trailing: HStack {
            Button(action: {
                isReminderViewPresented = true
            }) {
                Image(systemName: "bell")
            }
            Button(action: {
                // Set the initial values in the text fields
                editedName = record.name
                editedCategory = record.category
                editedData1 = record.data1
                editedData2 = record.data2
                editedDateDS1 = record.dateDS1
                editedDetailsDS1 = record.detailsDS1
                editedDetailsDS2 = record.detailsDS2
                editedDetailsDS3 = record.detailsDS3
                editedDateDS4 = record.dateDS4
                editedDetailsDS4 = record.detailsDS4
                editedDetailsDS5 = record.detailsDS5
                editedDataDS6 = record.dataDS6
                editedDetailsDS6 = record.detailsDS6
                editedPhotos = record.photoPaths.compactMap { loadImageFromDocumentDirectory($0) }
                
                isEditViewPresented = true
            }) {
                Image(systemName: "square.and.pencil")
            }
        })
        .sheet(isPresented: $isEditViewPresented) {
            EditRecordView(
                record: record,
                editedName: $editedName,
                editedCategory: $editedCategory,
                editedData1: $editedData1,
                editedData2: $editedData2,
                editedDateDS1: $editedDateDS1,
                editedStartMonthDS1: $editedStartMonthDS1,
                editedEndMonthDS1: $editedEndMonthDS1,
                editedDetailsDS1: $editedDetailsDS1,
                editedStartMonthDS2: $editedStartMonthDS2,
                editedEndMonthDS2: $editedEndMonthDS2,
                editedDetailsDS2: $editedDetailsDS2,
                editedStartMonthDS3: $editedStartMonthDS3,
                editedEndMonthDS3: $editedEndMonthDS3,
                editedDetailsDS3: $editedDetailsDS3,
                editedDateDS4: $editedDateDS4,
                editedStartMonthDS4: $editedStartMonthDS4,
                editedEndMonthDS4: $editedEndMonthDS4,
                editedDetailsDS4: $editedDetailsDS4,
                editedStartMonthDS5: $editedStartMonthDS5,
                editedEndMonthDS5: $editedEndMonthDS5,
                editedDetailsDS5: $editedDetailsDS5,
                editedDataDS6: $editedDataDS6,
                editedStartMonthDS6: $editedStartMonthDS6,
                editedEndMonthDS6: $editedEndMonthDS6,
                editedDetailsDS6: $editedDetailsDS6,
                editedPhotos: $editedPhotos,
                onEditFinished: {
                    isEditViewPresented = false
                    // Add logic to update the bonsai data
                    bonsaiData.editRecord(record: record, updatedName: editedName, updatedCategory: editedCategory, updatedData1: editedData1, updatedData2: editedData2, updatedDateDS1: editedDateDS1, updatedselectedStartMonthDS1: editedStartMonthDS1, updatedselectedEndMonthDS1: editedEndMonthDS1, updatedDetailsDS1: editedDetailsDS1, updatedselectedStartMonthDS2: editedStartMonthDS2, updatedselectedEndMonthDS2: editedEndMonthDS2, updatedDetailsDS2: editedDetailsDS2, updatedselectedStartMonthDS3: editedStartMonthDS3, updatedselectedEndMonthDS3: editedEndMonthDS3, updatedDetailsDS3: editedDetailsDS3, updatedDateDS4: editedDateDS4, updatedselectedStartMonthDS4: editedStartMonthDS4, updatedselectedEndMonthDS4: editedEndMonthDS4, updatedDetailsDS4: editedDetailsDS4, updatedselectedStartMonthDS5: editedStartMonthDS5, updatedselectedEndMonthDS5: editedEndMonthDS5, updatedDetailsDS5: editedDetailsDS5, updatedDataDS6: editedDataDS6, updatedselectedStartMonthDS6: editedStartMonthDS6, updatedselectedEndMonthDS6: editedEndMonthDS6, updatedDetailsDS6: editedDetailsDS6, updatedPhotos: editedPhotos.map { $0.pngData()?.base64EncodedString() ?? "" })
                }
            )
        }
        .sheet(isPresented: $isReminderViewPresented) {
            ReminderView(record: record) { message, date in
                bonsaiData.scheduleNotification(for: record, message: message, date: date)
            }
        }
        .sheet(isPresented: $isImageFullScreenPresented) {
            if let selectedImage = selectedImage {
                ImageFullScreenView(images: record.photoPaths.compactMap { loadImageFromDisk(with: $0) ?? UIImage() }, isPresented: $isImageFullScreenPresented)
            }
        }
    }
    
    private let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        return formatter
    }()
    
    
    private func loadImageFromDisk(with filename: String) -> UIImage? {
        let fileURL = getDocumentsDirectory().appendingPathComponent(filename)
        guard let imageData = try? Data(contentsOf: fileURL) else { return nil }
        return UIImage(data: imageData)
    }
    
    private func getDocumentsDirectory() -> URL {
        return FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
    }
    
    func loadImageFromDocumentDirectory(_ fileName: String) -> UIImage? {
        let fileURL = getDocumentsDirectory().appendingPathComponent(fileName)
        if let data = try? Data(contentsOf: fileURL), let image = UIImage(data: data) {
            return image
        }
        return nil
    }
}
